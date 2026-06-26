import type { MatchField } from "@/services/componentSearchIndex";

export const COMPONENT_SEARCH_MATCH_FIELD_LABEL: Record<MatchField, string> = {
  name: "name",
  description: "description",
  io: "inputs/outputs",
  implementation: "command",
  metadata: "metadata",
};

function joinReadableList(values: string[]): string {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export function formatMatchedFieldsExplanation(
  fields: MatchField[] | undefined,
): string | undefined {
  if (!fields || fields.length === 0) return undefined;

  const labels = Array.from(
    new Set(fields.map((field) => COMPONENT_SEARCH_MATCH_FIELD_LABEL[field])),
  );
  return `Matched ${joinReadableList(labels)}.`;
}
