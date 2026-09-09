/**
 * CSOM bridge handlers — the spec-mutation slice of `ToolBridgeApi`.
 *
 * Each handler resolves which spec in the tree owns the `$id` it was given
 * (`mutationTarget.ts`) and mutates that spec inside `deps.undo.withGroup(...)`,
 * so an edit lands in the subgraph the entity actually lives in. The undo
 * manager and autosave are both anchored at the root spec and traverse the whole
 * document, so nested edits are undoable and persisted without extra wiring.
 * Mirrors the worker-side `csomTools.ts` tool surface one-to-one.
 */
import type {
  ConnectArgs,
  ToolBridgeApi,
  ValidationResult,
} from "@/agent/toolBridgeApi";
import {
  describeBindingEndpointProblem,
  findBindingEndpointProblems,
} from "@/models/componentSpec/queries/bindingEndpoints";
import type { EntityLocationOf } from "@/models/componentSpec/queries/locateEntity";
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
  setInputDescription,
  setInputType,
  setInputValue,
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
  toValidationResult,
} from "@/routes/v2/shared/components/AiChat/toolBridge/utils";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { hydrateComponentReference } from "@/services/componentService";

import {
  applyToTarget,
  describeEntityLocation,
  explainNameCollision,
  explainNotASubgraph,
  resolveArgumentValue,
  resolveConnectable,
  resolveDestination,
  resolveTarget,
} from "./mutationTarget";

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
        activeSubgraphTaskId: deps.getActiveSubgraphTaskId(),
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

    async addTask({ name, componentRef, inSubgraphTaskId }) {
      // Hydration fetches over the network; resolving the destination before it
      // would hand us a subgraph spec the user could detach (undo, navigation,
      // a reload) while we wait, and the task would land in an orphaned tree.
      // `getSpec` reads whichever pipeline is open now, though, so the root has
      // to be pinned across the fetch or the add follows the user into another
      // pipeline.
      const rootAtCallTime = requireSpec(deps);
      const hydrated =
        (await hydrateComponentReference(componentRef)) ?? componentRef;
      const root = requireSpec(deps);
      if (root !== rootAtCallTime) {
        return {
          success: false,
          error: `Nothing was added — the open pipeline changed to "${root.name}" while the component was loading. Check with the user before retrying.`,
        };
      }

      const destination = resolveDestination(root, inSubgraphTaskId);
      if (!destination.ok) {
        return { success: false, error: destination.error };
      }
      const { spec } = destination;

      const task = addTask(
        deps.undo,
        spec,
        hydrated,
        computeNextPosition(spec),
      );
      if (!task) {
        return { success: false, error: "addTask returned no task" };
      }
      if (name && task.name !== name) {
        renameTask(deps.undo, spec, task.$id, name);
      }
      return { success: true, taskId: task.$id, name: task.name };
    },

    async deleteTask(entityId) {
      const root = requireSpec(deps);
      return applyToTarget(root, entityId, "task", (location) =>
        deleteTask(deps.undo, location.spec, entityId),
      );
    },

    async renameTask(entityId, newName) {
      const root = requireSpec(deps);
      return applyToTarget(
        root,
        entityId,
        "task",
        (location) => renameTask(deps.undo, location.spec, entityId, newName),
        (location) =>
          explainNameCollision(
            location.spec.tasks,
            entityId,
            newName,
            location,
          ),
      );
    },

    async addInput({
      name,
      type,
      description,
      defaultValue,
      optional,
      inSubgraphTaskId,
    }) {
      const destination = resolveDestination(
        requireSpec(deps),
        inSubgraphTaskId,
      );
      if (!destination.ok) {
        return { success: false, error: destination.error };
      }
      const { spec } = destination;

      const input = addInput(deps.undo, spec, computeNextPosition(spec), name);
      if (type) setInputType(deps.undo, spec, input.$id, type);
      if (description)
        setInputDescription(deps.undo, spec, input.$id, description);
      if (defaultValue) setInputValue(deps.undo, spec, input.$id, defaultValue);
      if (optional !== undefined) {
        deps.undo.withGroup("Set input optional", () => {
          input.setOptional(optional);
        });
      }
      return { success: true, inputId: input.$id, name: input.name };
    },

    async deleteInput(entityId) {
      const root = requireSpec(deps);
      return applyToTarget(root, entityId, "input", (location) =>
        deleteInput(deps.undo, location.spec, entityId, location.parentContext),
      );
    },

    async renameInput(entityId, newName) {
      const root = requireSpec(deps);
      return applyToTarget(
        root,
        entityId,
        "input",
        (location) =>
          renameInput(
            deps.undo,
            location.spec,
            entityId,
            newName,
            location.parentContext,
          ),
        (location) =>
          explainNameCollision(
            location.spec.inputs,
            entityId,
            newName,
            location,
          ),
      );
    },

    async addOutput({ name, type, description, inSubgraphTaskId }) {
      const destination = resolveDestination(
        requireSpec(deps),
        inSubgraphTaskId,
      );
      if (!destination.ok) {
        return { success: false, error: destination.error };
      }
      const { spec } = destination;

      const output = addOutput(
        deps.undo,
        spec,
        computeNextPosition(spec),
        name,
      );
      if (type) {
        deps.undo.withGroup("Set output type", () => output.setType(type));
      }
      if (description)
        setOutputDescription(deps.undo, spec, output.$id, description);
      return { success: true, outputId: output.$id, name: output.name };
    },

    async deleteOutput(entityId) {
      const root = requireSpec(deps);
      return applyToTarget(root, entityId, "output", (location) =>
        deleteOutput(
          deps.undo,
          location.spec,
          entityId,
          location.parentContext,
        ),
      );
    },

    async renameOutput(entityId, newName) {
      const root = requireSpec(deps);
      return applyToTarget(
        root,
        entityId,
        "output",
        (location) =>
          renameOutput(
            deps.undo,
            location.spec,
            entityId,
            newName,
            location.parentContext,
          ),
        (location) =>
          explainNameCollision(
            location.spec.outputs,
            entityId,
            newName,
            location,
          ),
      );
    },

    async connectNodes(args: ConnectArgs) {
      const root = requireSpec(deps);

      const source = resolveConnectable(root, args.sourceEntityId);
      if (!source.ok) return { success: false, error: source.error };
      const target = resolveConnectable(root, args.targetEntityId);
      if (!target.ok) return { success: false, error: target.error };

      if (source.location.spec !== target.location.spec) {
        return {
          success: false,
          error: `Cannot connect ${describeEntityLocation(source.location, args.sourceEntityId)} to ${describeEntityLocation(target.location, args.targetEntityId)} — a connection cannot cross a subgraph boundary. Route the value through the subgraph's own inputs and outputs instead.`,
        };
      }

      const spec = source.location.spec;

      const problems = findBindingEndpointProblems(spec, args);
      if (problems.length > 0) {
        return {
          success: false,
          error: `Nothing was connected. ${problems.map(describeBindingEndpointProblem).join(" ")}`,
        };
      }

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
      const root = requireSpec(deps);
      return applyToTarget(root, entityId, "binding", (location) => {
        deleteSelectedEdgesByEdgeIds(deps.undo, location.spec, [
          `edge_${entityId}`,
        ]);
        return !location.spec.bindings.some((b) => b.$id === entityId);
      });
    },

    async setTaskArgument(taskEntityId, inputName, value) {
      const target = resolveTarget(requireSpec(deps), taskEntityId, "task");
      if (!target.ok) {
        return { success: false, error: target.error };
      }
      const { location } = target;

      const hasInput = location.entity.resolvedComponentSpec?.inputs?.some(
        (i) => i.name === inputName,
      );
      if (!hasInput) {
        return {
          success: false,
          error: `Task "${location.entity.name}" has no input named "${inputName}"`,
        };
      }

      const resolved = resolveArgumentValue(location, value);
      if (!resolved.ok) {
        return { success: false, error: resolved.error };
      }

      deps.undo.withGroup("Set task argument", () => {
        location.spec.setTaskArgument(taskEntityId, inputName, resolved.value);
      });
      return { success: true };
    },

    async createSubgraph(taskEntityIds, subgraphName) {
      const root = requireSpec(deps);

      const distinctIds = [...new Set(taskEntityIds)];
      if (distinctIds.length < 2) {
        return {
          success: false,
          error:
            "Could not create subgraph — pass the $ids of at least two distinct tasks to group. Wrapping a single task in a subgraph is not useful.",
        };
      }

      const locations: Array<{
        id: string;
        location: EntityLocationOf<"task">;
      }> = [];
      for (const taskEntityId of distinctIds) {
        const target = resolveTarget(root, taskEntityId, "task");
        if (!target.ok) {
          return { success: false, error: target.error };
        }
        locations.push({ id: taskEntityId, location: target.location });
      }

      const first = locations[0];
      if (!first) {
        return {
          success: false,
          error:
            "Could not create subgraph — pass the $ids of at least two distinct tasks to group.",
        };
      }
      const stray = locations.find(
        (l) => l.location.spec !== first.location.spec,
      );
      if (stray) {
        return {
          success: false,
          error: `Cannot group ${describeEntityLocation(first.location, first.id)} with ${describeEntityLocation(stray.location, stray.id)} — every task in a new subgraph must already live in the same pipeline or subgraph.`,
        };
      }

      const spec = first.location.spec;
      const subgraphTask = createSubgraph(
        deps.undo,
        spec,
        distinctIds,
        subgraphName,
        computeNextPosition(spec),
      );
      if (!subgraphTask) {
        return {
          success: false,
          error:
            "Could not create subgraph — pass the $ids of at least two distinct tasks that can be grouped together.",
        };
      }
      return { success: true, subgraphTaskId: subgraphTask.$id };
    },

    async unpackSubgraph(taskEntityId) {
      const root = requireSpec(deps);
      return applyToTarget(
        root,
        taskEntityId,
        "task",
        (location) =>
          unpackSubgraphTask(deps.undo, location.spec, taskEntityId),
        (location) => explainNotASubgraph(location, taskEntityId),
      );
    },

    async validatePipeline(): Promise<ValidationResult> {
      return toValidationResult(requireSpec(deps));
    },
  };
}
