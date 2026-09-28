import type { IconName } from "@/components/ui/icon";
import {
  conceptForEntity,
  resourceMeta,
} from "@/services/projects/resourceMeta";

// The backend stores `entity` as a plain string and expects more members, so an
// unrecognised one still needs something to render as.
const UNKNOWN_ENTITY_ICON: IconName = "Box";

export const entityIcon = (entity: string): IconName => {
  const concept = conceptForEntity(entity);
  return concept ? resourceMeta(concept).icon : UNKNOWN_ENTITY_ICON;
};

/**
 * A resource that points at something by id — a pipeline, an agent session —
 * only borrows it, so taking it out of the project leaves it where it lives. A
 * resource that carries its own payload, like a document, is the only copy
 * there is, and taking it out destroys it.
 */
export const removingDestroys = (resource: { entityId: string | null }) =>
  resource.entityId === null;
