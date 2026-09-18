import type { IconName } from "@/components/ui/icon";
import {
  conceptForEntity,
  resourceMeta,
} from "@/services/projects/resourceMeta";
import type { ProjectResourceSummary } from "@/services/projects/types";

import { claimsLocalPipeline } from "./localPipelinePointer";

type ResourceRowShape = Pick<
  ProjectResourceSummary,
  "entity" | "entityId" | "extraData"
>;

// The backend stores `entity` as a plain string and expects more members, so an
// unrecognised one still needs something to render as.
const UNKNOWN_ENTITY_ICON: IconName = "Box";

export const entityIcon = (entity: string): IconName => {
  const concept = conceptForEntity(entity);
  return concept ? resourceMeta(concept).icon : UNKNOWN_ENTITY_ICON;
};

/**
 * A group is headed by what the API calls its rows, which leaves rows inside it
 * that are not all the same thing — a browser-held pipeline is filed as a
 * document. Each row therefore says what it is on its own.
 */
export const resourceIcon = (resource: ResourceRowShape): IconName =>
  claimsLocalPipeline(resource)
    ? entityIcon("pipeline")
    : entityIcon(resource.entity);

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
