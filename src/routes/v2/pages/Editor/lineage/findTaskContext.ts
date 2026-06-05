import type { ComponentSpec, Task } from "@/models/componentSpec";

export interface TaskContext {
  /** The spec whose direct `tasks` array contains the task. */
  spec: ComponentSpec;
  task: Task;
}

/**
 * Locate a task by id anywhere in a spec tree, recursing through subgraphs.
 * Returns the task together with the (sub)spec that directly contains it, so
 * callers can mutate it in the right scope (e.g. `replaceTask` cleans up the
 * containing spec's bindings).
 */
export function findTaskContext(
  rootSpec: ComponentSpec,
  taskId: string,
): TaskContext | undefined {
  for (const task of rootSpec.tasks) {
    if (task.$id === taskId) return { spec: rootSpec, task };
    if (task.subgraphSpec) {
      const found = findTaskContext(task.subgraphSpec, taskId);
      if (found) return found;
    }
  }
  return undefined;
}
