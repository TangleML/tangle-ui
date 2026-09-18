export const PROJECT_ID_SEARCH_PARAM = "projectId";

/**
 * The router JSON-parses search params, so a project id of digits arrives as a
 * number and anything at all can arrive as an array or object.
 */
export function readProjectIdParam(search: unknown): string | undefined {
  if (typeof search !== "object" || search === null) {
    return undefined;
  }

  const value = (search as Record<string, unknown>)[PROJECT_ID_SEARCH_PARAM];

  if (typeof value === "string") {
    return value.trim() || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}
