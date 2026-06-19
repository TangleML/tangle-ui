import type { ComponentSpec } from "@/models/componentSpec";
import type { Task } from "@/models/componentSpec/entities/task";
import { hydrateComponentReference } from "@/services/componentService";

/**
 * Hydrate every task's component reference in a freshly loaded spec so the
 * live CSOM always carries a resolvable `componentRef.spec`.
 */
export async function hydrateLoadedSpecRefs(
  spec: ComponentSpec,
): Promise<void> {
  await Promise.all(spec.tasks.map((task) => hydrateTaskRef(task)));
}

async function hydrateTaskRef(task: Task): Promise<void> {
  if (task.subgraphSpec) {
    await hydrateLoadedSpecRefs(task.subgraphSpec);
    return;
  }

  const hydrated = await hydrateComponentReference(task.componentRef);
  if (!hydrated) return;

  task.setComponentRef(hydrated);

  if (task.subgraphSpec) {
    await hydrateLoadedSpecRefs(task.subgraphSpec);
  }
}
