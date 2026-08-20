/**
 * Read-only handler exposing one subgraph's contents on demand.
 *
 * `serializeSpecForAi` narrows every task's component spec to its interface,
 * so a subgraph task in `get_pipeline_state` carries `isSubgraph: true` and
 * its ports but nothing about what runs inside it. Inlining nested graphs
 * there would grow every request by the whole tree, so the model asks for
 * the one subgraph it cares about and gets the same `AiSpec` shape back —
 * recursing further through the `isSubgraph` flags inside it.
 */
import type { SubgraphStateResult, ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { ComponentSpec, Task } from "@/models/componentSpec";
import { serializeSpecForAi } from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";

import type { BridgeDeps } from "./utils";
import { requireSpec } from "./utils";

type SubgraphHandlers = Pick<ToolBridgeApi, "getSubgraphState">;

function findTaskById(
  spec: ComponentSpec,
  taskEntityId: string,
): Task | undefined {
  for (const task of spec.tasks) {
    if (task.$id === taskEntityId) {
      return task;
    }

    const nested =
      task.subgraphSpec && findTaskById(task.subgraphSpec, taskEntityId);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

export function createSubgraphBridgeHandlers(
  deps: BridgeDeps,
): SubgraphHandlers {
  return {
    async getSubgraphState(taskEntityId): Promise<SubgraphStateResult> {
      const task = findTaskById(requireSpec(deps), taskEntityId);

      if (!task) {
        return {
          success: false,
          error: `No task with $id "${taskEntityId}" exists in this pipeline.`,
        };
      }

      if (!task.subgraphSpec) {
        return {
          success: false,
          error: `Task "${task.name}" is not a subgraph — it has no inner tasks to inspect.`,
        };
      }

      return { success: true, spec: serializeSpecForAi(task.subgraphSpec) };
    },
  };
}
