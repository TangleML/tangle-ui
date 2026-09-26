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
 * Groups are headed by the API's `entity`, which puts unlike rows together — a
 * browser-held pipeline is filed as a document. So each row says what its
 * `extra_data` calls itself, unless the group already says it. The text is the
 * backend's and PATCHable, so it is cut to what a badge can hold.
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
 * A resource that points at something only borrows it, so removing the row
 * leaves it where it lives. A resource carrying its own content, like a
 * document, is the only copy there is. A row naming a browser-held pipeline
 * counts as a pointer however broken it has become: it never held a pipeline of
 * its own, so removing it cannot destroy one.
 */
export const removingDestroys = (resource: ResourceRowShape) =>
  resource.entityId === null && !namesLocalPipeline(resource);

export function removalConsequence(resource: ResourceRowShape) {
  if (namesLocalPipeline(resource)) {
    return "This only takes it out of this project. The pipeline itself is not deleted and stays in the browser that holds it.";
  }
  if (removingDestroys(resource)) {
    return "This is the only copy, so deleting it here deletes it for good.";
  }
  return "This only takes it out of this project. The item itself is not deleted and stays wherever it lives.";
}
