/**
 * Main-thread implementation of the agent's `ToolBridgeApi`.
 *
 * Each method mutates the LIVE MobX `ComponentSpec` from the editor
 * session inside an undo group, so the agent's edits are user-visible
 * immediately and undoable as a single step. The worker proxies these
 * methods via Comlink; no command serialization or tempId remapping is
 * needed.
 *
 * Bridge deps are deliberately tiny — the bridge owns no React or MobX
 * subscriptions of its own, which keeps it trivially testable: feed it
 * a `ComponentSpec` and an `UndoGroupable` and every method works.
 */
import type {
  ConnectArgs,
  ToolBridgeApi,
  ValidationResult,
} from "@/agent/toolBridgeApi";
import type { ComponentSpec } from "@/models/componentSpec";
import { validateSpec } from "@/models/componentSpec/validation/validateSpec";
import {
  connectNodes,
  deleteSelectedEdgesByEdgeIds,
} from "@/routes/v2/pages/Editor/store/actions/connection.actions";
import {
  addInput,
  addOutput,
  deleteInput,
  deleteOutput,
  renameInput,
  renameOutput,
  setInputDefaultValue,
  setInputDescription,
  setInputType,
  setOutputDescription,
} from "@/routes/v2/pages/Editor/store/actions/io.actions";
import {
  createSubgraph,
  renamePipeline,
  updatePipelineDescription,
} from "@/routes/v2/pages/Editor/store/actions/pipeline.actions";
import {
  addTask,
  deleteTask,
  renameTask,
  unpackSubgraphTask,
} from "@/routes/v2/pages/Editor/store/actions/task.actions";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { hydrateComponentReference } from "@/services/componentService";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

import { serializeSpecForAi } from "./serializeSpecForAi";

const DEFAULT_POSITION = { x: 250, y: 250 };
const POSITION_OFFSET = 200;

interface BridgeDeps {
  getSpec: () => ComponentSpec | null;
  getActiveSubgraphPath: () => string[];
  undo: UndoGroupable;
}

interface EntityWithAnnotations {
  annotations: { get(key: string): unknown };
}

function computeNextPosition(spec: ComponentSpec): { x: number; y: number } {
  const allEntities: EntityWithAnnotations[] = [
    ...spec.tasks,
    ...spec.inputs,
    ...spec.outputs,
  ];
  if (allEntities.length === 0) return DEFAULT_POSITION;

  let maxX = 0;
  let maxY = 0;
  for (const entity of allEntities) {
    const pos = entity.annotations.get(EDITOR_POSITION_ANNOTATION) as
      | { x: number; y: number }
      | undefined;
    if (pos) {
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
  }
  return { x: maxX + POSITION_OFFSET, y: maxY };
}

/**
 * Builds the bridge implementation. Returned object is intended to be
 * exposed to the worker via `Comlink.proxy()`. Methods throw when the
 * spec is unavailable (no pipeline open) so the worker surfaces a clear
 * error to the model.
 */
export function createToolBridge(deps: BridgeDeps): ToolBridgeApi {
  function requireSpec(): ComponentSpec {
    const spec = deps.getSpec();
    if (!spec) {
      throw new Error(
        "No pipeline is currently open — open a pipeline before asking the agent to edit it.",
      );
    }
    return spec;
  }

  return {
    async getPipelineState() {
      return serializeSpecForAi(requireSpec(), {
        activeSubgraphPath: deps.getActiveSubgraphPath(),
      });
    },

    async setPipelineName(name) {
      const spec = requireSpec();
      renamePipeline(deps.undo, spec, name);
      return { success: true };
    },

    async setPipelineDescription(description) {
      const spec = requireSpec();
      updatePipelineDescription(deps.undo, spec, description);
      return { success: true };
    },

    async addTask({ name, componentRef }) {
      const spec = requireSpec();
      const hydrated =
        (await hydrateComponentReference(componentRef)) ?? componentRef;
      const position = computeNextPosition(spec);
      const task = addTask(deps.undo, spec, hydrated, position);
      if (name && task.name !== name) {
        renameTask(deps.undo, spec, task.$id, name);
      }
      return { success: true, taskId: task.$id, name: task.name };
    },

    async deleteTask(entityId) {
      const spec = requireSpec();
      return { success: deleteTask(deps.undo, spec, entityId) };
    },

    async renameTask(entityId, newName) {
      const spec = requireSpec();
      return { success: renameTask(deps.undo, spec, entityId, newName) };
    },

    async addInput({ name, type, description, defaultValue, optional }) {
      const spec = requireSpec();
      const position = computeNextPosition(spec);
      const input = addInput(deps.undo, spec, position, name);
      if (type) setInputType(deps.undo, spec, input.$id, type);
      if (description)
        setInputDescription(deps.undo, spec, input.$id, description);
      if (defaultValue)
        setInputDefaultValue(deps.undo, spec, input.$id, defaultValue);
      if (optional !== undefined) {
        deps.undo.withGroup("Set input optional", () => {
          input.setOptional(optional);
        });
      }
      return { success: true, inputId: input.$id, name: input.name };
    },

    async deleteInput(entityId) {
      const spec = requireSpec();
      return { success: deleteInput(deps.undo, spec, entityId) };
    },

    async renameInput(entityId, newName) {
      const spec = requireSpec();
      return { success: renameInput(deps.undo, spec, entityId, newName) };
    },

    async addOutput({ name, type, description }) {
      const spec = requireSpec();
      const position = computeNextPosition(spec);
      const output = addOutput(deps.undo, spec, position, name);
      if (type) {
        deps.undo.withGroup("Set output type", () => output.setType(type));
      }
      if (description)
        setOutputDescription(deps.undo, spec, output.$id, description);
      return { success: true, outputId: output.$id, name: output.name };
    },

    async deleteOutput(entityId) {
      const spec = requireSpec();
      return { success: deleteOutput(deps.undo, spec, entityId) };
    },

    async renameOutput(entityId, newName) {
      const spec = requireSpec();
      return { success: renameOutput(deps.undo, spec, entityId, newName) };
    },

    async connectNodes(args: ConnectArgs) {
      const spec = requireSpec();
      const ok = connectNodes(deps.undo, spec, {
        sourceNodeId: args.sourceEntityId,
        sourceHandleId: `output_${args.sourcePortName}`,
        targetNodeId: args.targetEntityId,
        targetHandleId: `input_${args.targetPortName}`,
      });
      if (!ok) {
        return {
          success: false,
          error:
            "Could not create binding — invalid source/target combination.",
        };
      }
      const binding = spec.bindings.find(
        (b) =>
          b.sourceEntityId === args.sourceEntityId &&
          b.sourcePortName === args.sourcePortName &&
          b.targetEntityId === args.targetEntityId &&
          b.targetPortName === args.targetPortName,
      );
      return { success: true, bindingId: binding?.$id };
    },

    async deleteEdge(entityId) {
      const spec = requireSpec();
      deleteSelectedEdgesByEdgeIds(deps.undo, spec, [`edge_${entityId}`]);
      return { success: true };
    },

    async setTaskArgument(taskEntityId, inputName, value) {
      const spec = requireSpec();
      deps.undo.withGroup("Set task argument", () => {
        spec.setTaskArgument(taskEntityId, inputName, value);
      });
      return { success: true };
    },

    async createSubgraph(taskEntityIds, subgraphName) {
      const spec = requireSpec();
      const position = computeNextPosition(spec);
      const subgraphTask = createSubgraph(
        deps.undo,
        spec,
        taskEntityIds,
        subgraphName,
        position,
      );
      if (!subgraphTask) {
        return { success: false, error: "Could not create subgraph" };
      }
      return { success: true, subgraphTaskId: subgraphTask.$id };
    },

    async unpackSubgraph(taskEntityId) {
      const spec = requireSpec();
      return { success: unpackSubgraphTask(deps.undo, spec, taskEntityId) };
    },

    async validatePipeline(): Promise<ValidationResult> {
      const issues = validateSpec(requireSpec());
      return {
        valid: issues.length === 0,
        issueCount: issues.length,
        issues: issues.map((i) => ({
          type: i.type,
          severity: i.severity,
          message: i.message,
          entityId: i.entityId,
          issueCode: i.issueCode,
        })),
      };
    },
  };
}
