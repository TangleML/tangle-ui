export const ENTITY_ORDER = ["pipeline", "agent_session", "document"];

const EMPTY_LABEL = "Empty";

const humanizeEntity = (entity: string) => entity.replaceAll("_", " ");

const pluralize = (entity: string, count: number) =>
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
