import type { IconName } from "@/components/ui/icon";

const ENTITY_ICONS: Record<string, IconName> = {
  pipeline: "GitBranch",
  agent_session: "Bot",
  document: "FileText",
};

// The backend stores `entity` as a plain string and expects more members, so an
// unrecognised one still needs something to render as.
const UNKNOWN_ENTITY_ICON: IconName = "Box";

export const entityIcon = (entity: string): IconName =>
  ENTITY_ICONS[entity] ?? UNKNOWN_ENTITY_ICON;

/**
 * A resource that points at something by id — a pipeline, an agent session —
 * only borrows it, so taking it out of the project leaves it where it lives. A
 * resource that carries its own payload, like a document, is the only copy
 * there is, and taking it out destroys it.
 */
export const removingDestroys = (resource: { entityId: string | null }) =>
  resource.entityId === null;
