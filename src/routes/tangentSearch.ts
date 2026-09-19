export const TANGENT_SESSION_SEARCH_PARAM = "session";

const NEW_SESSION = "new";

export type TangentSessionParam =
  { kind: "new" } | { kind: "existing"; sessionId: string };

/**
 * The router JSON-parses search params, so a session id of digits arrives as a
 * number and anything at all can arrive as an array or object.
 */
export function readTangentSessionParam(
  search: unknown,
): TangentSessionParam | undefined {
  if (typeof search !== "object" || search === null) {
    return undefined;
  }

  const value = (search as Record<string, unknown>)[
    TANGENT_SESSION_SEARCH_PARAM
  ];

  const sessionId =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : "";

  if (sessionId === "") {
    return undefined;
  }
  return sessionId === NEW_SESSION
    ? { kind: "new" }
    : { kind: "existing", sessionId };
}

export const newTangentSessionSearch = {
  [TANGENT_SESSION_SEARCH_PARAM]: NEW_SESSION,
};

export const tangentSessionSearch = (sessionId: string) => ({
  [TANGENT_SESSION_SEARCH_PARAM]: sessionId,
});
