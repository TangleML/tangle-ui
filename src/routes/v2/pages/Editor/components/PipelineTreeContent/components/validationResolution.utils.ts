import type { ComponentSpec, Task } from "@/models/componentSpec";
import { navigationStore } from "@/routes/v2/shared/store/navigationStore";

export function findTaskById(
  spec: ComponentSpec,
  entityId: string,
): Task | undefined {
  const directTask = spec.tasks.find((t) => t.$id === entityId);
  if (directTask) return directTask;

  for (const [, nestedSpec] of navigationStore.nestedSpecs) {
    const nestedTask = nestedSpec.tasks.find((t) => t.$id === entityId);
    if (nestedTask) return nestedTask;
  }
  return undefined;
}
