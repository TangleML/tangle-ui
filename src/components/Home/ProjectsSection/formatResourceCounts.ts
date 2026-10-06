import { AGENT_SESSION } from "@/services/projects/resourceDescriptor";

export const ENTITY_ORDER = ["pipeline", AGENT_SESSION, "document"];

/**
 * Sessions belong to Tangent. With it off they cannot be seen or started, so
 * counting them would name a feature that is not there.
 */
export const visibleResourceCounts = (
  counts: Record<string, number>,
  tangentEnabled: boolean,
): Record<string, number> => {
  if (tangentEnabled) return counts;

  const { [AGENT_SESSION]: _sessions, ...rest } = counts;
  return rest;
};

const EMPTY_LABEL = "Empty";

const humanizeEntity = (entity: string) => entity.replaceAll("_", " ");

export const pluralize = (entity: string, count: number) =>
  count === 1 ? humanizeEntity(entity) : `${humanizeEntity(entity)}s`;

const orderedEntities = (counts: Record<string, number>) => {
  const known = ENTITY_ORDER.filter((entity) => entity in counts);
  const unknown = Object.keys(counts)
    .filter((entity) => !ENTITY_ORDER.includes(entity))
    .sort();

  return [...known, ...unknown];
};

export const totalResourceCount = (counts: Record<string, number>) =>
  Object.values(counts).reduce((total, count) => total + count, 0);

export const formatResourceCounts = (counts: Record<string, number>) => {
  const parts = orderedEntities(counts)
    .filter((entity) => counts[entity] > 0)
    .map((entity) => `${counts[entity]} ${pluralize(entity, counts[entity])}`);

  return parts.length === 0 ? EMPTY_LABEL : parts.join(" · ");
};
