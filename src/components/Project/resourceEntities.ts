import type { IconName } from "@/components/ui/icon";
import { namesLocalPipeline } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";

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

const LOCAL_PIPELINE_LABEL = "Local pipeline";

const LABEL_LIMIT = 24;

function humanize(value: string) {
  const words = value.replaceAll(/[_-]+/g, " ").trim().slice(0, LABEL_LIMIT);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const sameAs = (label: string, entity: string) =>
  label.toLowerCase() === humanize(entity).toLowerCase();

/**
 * A group is headed by the entity the API files its rows under, which leaves a
 * group holding rows that are not all the same thing — a browser-held pipeline
 * is filed as a document. Whatever a row's `extra_data` calls itself is
 * therefore said on the row, and a row calling itself what its group already
 * says stays quiet. The text is the backend's, and anyone may PATCH it, so it
 * is cut to a length a badge can hold.
 */
export function resourceKindLabel(
  resource: ResourceRowShape,
): string | undefined {
  if (namesLocalPipeline(resource)) {
    return LOCAL_PIPELINE_LABEL;
  }

  const type = resource.extraData?.type;
  if (typeof type !== "string") {
    return undefined;
  }

  const label = humanize(type);
  return label && !sameAs(label, resource.entity) ? label : undefined;
}

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
  resource.entityId === null && !namesLocalPipeline(resource);
