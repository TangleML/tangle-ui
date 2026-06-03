/**
 * CSOM bridge handlers — the spec-mutation slice of `ToolBridgeApi`.
 *
 * Each handler mutates the live MobX `ComponentSpec` from `deps.getSpec()`
 * inside `deps.undo.withGroup(...)` so the agent's edits are user-visible
 * immediately and undoable as a single user step. Mirrors the worker-side
 * `csomTools.ts` tool surface one-to-one.
 */
import type {
  ConnectArgs,
  ToolBridgeApi,
  ValidationResult,
} from "@/agent/toolBridgeApi";
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
import { serializeSpecForAi } from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";
import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";
import {
  computeNextPosition,
  requireSpec,
} from "@/routes/v2/shared/components/AiChat/toolBridge/utils";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { hydrateComponentReference } from "@/services/componentService";

/**
 * CSOM handlers need the Editor's undo store to make the agent's spec
 * edits user-visible and undoable as a single step. `undo` lives here
 * (not in the shared `BridgeDeps`) because only the Editor's mutating
 * bridge depends on it.
 */
export type CsomBridgeDeps = BridgeDeps & { undo: UndoGroupable };

type CsomHandlers = Pick<
  ToolBridgeApi,
  | "getPipelineState"
  | "setPipelineName"
  | "setPipelineDescription"
  | "addTask"
  | "deleteTask"
  | "renameTask"
  | "addInput"
  | "deleteInput"
  | "renameInput"
  | "addOutput"
  | "deleteOutput"
  | "renameOutput"
  | "connectNodes"
  | "deleteEdge"
  | "setTaskArgument"
  | "createSubgraph"
  | "unpackSubgraph"
  | "validatePipeline"
>;

export function createCsomBridgeHandlers(deps: CsomBridgeDeps): CsomHandlers {
  return {
    async getPipelineState() {
      return serializeSpecForAi(requireSpec(deps), {
        activeSubgraphPath: deps.getActiveSubgraphPath(),
      });
    },

    async setPipelineName(name) {
      const spec = requireSpec(deps);
      renamePipeline(deps.undo, spec, name);
      return { success: true };
    },

    async setPipelineDescription(description) {
      const spec = requireSpec(deps);
      updatePipelineDescription(deps.undo, spec, description);
      return { success: true };
    },

    async addTask({ name, componentRef }) {
      const spec = requireSpec(deps);
      const hydrated =
        (await hydrateComponentReference(componentRef)) ?? componentRef;
      const position = computeNextPosition(spec);
      const task = addTask(deps.undo, spec, hydrated, position);
      if (!task) {
        return { success: false, error: "addTask returned no task" };
      }
      if (name && task.name !== name) {
        renameTask(deps.undo, spec, task.$id, name);
      }
      return { success: true, taskId: task.$id, name: task.name };
    },

    async deleteTask(entityId) {
      const spec = requireSpec(deps);
      return { success: deleteTask(deps.undo, spec, entityId) };
    },

    async renameTask(entityId, newName) {
      const spec = requireSpec(deps);
      return { success: renameTask(deps.undo, spec, entityId, newName) };
    },

    async addInput({ name, type, description, defaultValue, optional }) {
      const spec = requireSpec(deps);
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
      const spec = requireSpec(deps);
      return { success: deleteInput(deps.undo, spec, entityId) };
    },

    async renameInput(entityId, newName) {
      const spec = requireSpec(deps);
      return { success: renameInput(deps.undo, spec, entityId, newName) };
    },

    async addOutput({ name, type, description }) {
      const spec = requireSpec(deps);
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
      const spec = requireSpec(deps);
      return { success: deleteOutput(deps.undo, spec, entityId) };
    },

    async renameOutput(entityId, newName) {
      const spec = requireSpec(deps);
      return { success: renameOutput(deps.undo, spec, entityId, newName) };
    },

    async connectNodes(args: ConnectArgs) {
      const spec = requireSpec(deps);
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
      if (!binding) {
        return {
          success: true,
          error: "Connection created but binding id could not be resolved.",
        };
      }
      return { success: true, bindingId: binding.$id };
    },

    async deleteEdge(entityId) {
      const spec = requireSpec(deps);
      deleteSelectedEdgesByEdgeIds(deps.undo, spec, [`edge_${entityId}`]);
      return { success: true };
    },

    async setTaskArgument(taskEntityId, inputName, value) {
      const spec = requireSpec(deps);
      const task = spec.tasks.find((t) => t.$id === taskEntityId);
      if (!task) {
        return { success: false, error: `No task with id ${taskEntityId}` };
      }
      const hasInput = task.componentRef.spec?.inputs?.some(
        (i) => i.name === inputName,
      );
      if (!hasInput) {
        return {
          success: false,
          error: `Task has no input named "${inputName}"`,
        };
      }
      deps.undo.withGroup("Set task argument", () => {
        spec.setTaskArgument(taskEntityId, inputName, value);
      });
      return { success: true };
    },

    async createSubgraph(taskEntityIds, subgraphName) {
      const spec = requireSpec(deps);
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
      const spec = requireSpec(deps);
      return { success: unpackSubgraphTask(deps.undo, spec, taskEntityId) };
    },

    async validatePipeline(): Promise<ValidationResult> {
      const issues = validateSpec(requireSpec(deps));
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
