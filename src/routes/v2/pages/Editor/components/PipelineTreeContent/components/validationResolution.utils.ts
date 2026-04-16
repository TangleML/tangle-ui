import type { ComponentSpec, Task } from "@/models/componentSpec";

export function findTaskById(
  spec: ComponentSpec,
  entityId: string,
  nestedSpecs: ReadonlyMap<string, ComponentSpec>,
): Task | undefined {
  const directTask = spec.tasks.find((t) => t.$id === entityId);
  if (directTask) return directTask;

  for (const [, nestedSpec] of nestedSpecs) {
    const nestedTask = nestedSpec.tasks.find((t) => t.$id === entityId);
    if (nestedTask) return nestedTask;
  }
  return undefined;
}
