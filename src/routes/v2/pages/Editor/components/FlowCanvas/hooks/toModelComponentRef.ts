import type { ComponentReference } from "@/models/componentSpec";
import type { HydratedComponentReference } from "@/utils/componentSpec";

/**
 * Bridge between the legacy `HydratedComponentReference` and the models
 * `ComponentReference`: identical runtime shape, parallel type definitions
 * (`utils/componentSpec` vs `models/componentSpec`). Mirrors the cast the task
 * manifest's drop handler already performs.
 */
export function toModelComponentRef(
  ref: HydratedComponentReference,
): ComponentReference {
  return ref as ComponentReference;
}
