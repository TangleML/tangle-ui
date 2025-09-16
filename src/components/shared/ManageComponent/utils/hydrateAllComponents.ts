import { hydrateComponentReference } from "@/services/componentService";
import {
  type ComponentReference,
  type HydratedComponentReference,
} from "@/utils/componentSpec";
import { isHydratedComponentReference } from "@/utils/componentSpec";

export async function hydrateAllComponents(
  components: ComponentReference[],
): Promise<HydratedComponentReference[]> {
  return (
    await Promise.all(components.map((c) => hydrateComponentReference(c)))
  ).filter(isHydratedComponentReference);
}
