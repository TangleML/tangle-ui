import type { IconName } from "@/components/ui/icon";
import type { ProjectResourceSummary } from "@/services/projects/types";

import { claimsLocalPipeline } from "./localPipelinePointer";

type ResourceRowShape = Pick<
  ProjectResourceSummary,
  "entity" | "entityId" | "extraData"
>;

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
 * A resource that points at something — a pipeline on the backend, an agent
 * session, a pipeline in this browser — only borrows it, so taking it out of
 * the project leaves it where it lives. A resource that carries its own
 * content, like a document, is the only copy there is, and taking it out
 * destroys it.
 *
 * A row that names a browser-held pipeline is asked about in its weaker form:
 * however unusable its pointer has become, it has never held a pipeline of its
 * own, so removing it cannot destroy one.
 */
export const removingDestroys = (resource: ResourceRowShape) =>
  resource.entityId === null && !claimsLocalPipeline(resource);
