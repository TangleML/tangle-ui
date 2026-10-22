import type { IconName } from "@/components/ui/icon";
import {
  conceptForEntity,
  resourceMeta,
} from "@/services/projects/resourceMeta";
import type { ProjectResourceSummary } from "@/services/projects/types";

type ResourceRowShape = Pick<
  ProjectResourceSummary,
  "entity" | "entityId" | "metadata"
>;

// The backend stores `entity` as a plain string and expects more members, so an
// unrecognised one still needs something to render as.
const UNKNOWN_ENTITY_ICON: IconName = "Box";

export const entityIcon = (entity: string): IconName => {
  const concept = conceptForEntity(entity);
  return concept ? resourceMeta(concept).icon : UNKNOWN_ENTITY_ICON;
};

const LABEL_LIMIT = 24;

function humanize(value: string) {
  const words = value.replaceAll(/[_-]+/g, " ").trim().slice(0, LABEL_LIMIT);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const sameAs = (label: string, entity: string) =>
  label.toLowerCase() === humanize(entity).toLowerCase();

export function resourceKindLabel(
  resource: ResourceRowShape,
): string | undefined {
  const type = resource.metadata?.type;
  if (typeof type !== "string") {
    return undefined;
  }

  const label = humanize(type);
  return label && !sameAs(label, resource.entity) ? label : undefined;
}

export const removingDestroys = (resource: ResourceRowShape) =>
  resource.entityId === null;

export function removalConsequence(resource: ResourceRowShape) {
  if (removingDestroys(resource)) {
    return "This is the only copy, so deleting it here deletes it for good.";
  }
  return "This only takes it out of this project. The item itself is not deleted and stays wherever it lives.";
}
