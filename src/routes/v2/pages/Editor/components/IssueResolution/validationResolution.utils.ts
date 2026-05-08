import type { ComponentSpec, Task } from "@/models/componentSpec";

export function findTaskById(
  spec: ComponentSpec,
  entityId: string,
): Task | undefined {
  const directTask = spec.tasks.find((t) => t.$id === entityId);
  if (directTask) return directTask;

  for (const task of spec.tasks) {
    if (!task.subgraphSpec) continue;
    const found = findTaskById(task.subgraphSpec, entityId);
    if (found) return found;
  }
  return undefined;
}
