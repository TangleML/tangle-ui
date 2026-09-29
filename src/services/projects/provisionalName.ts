const PROVISIONAL_NAME = "provisionalName";

/**
 * Marks a name as one nobody chose — derived from the opening prompt, or
 * numbered — so the agent may replace it once it knows what the project is for.
 * Whoever renames next drops the mark, agent or human: the second name was
 * chosen by someone, which is the whole of what this asks.
 */
export function provisionalNameMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  return { ...(metadata ?? {}), [PROVISIONAL_NAME]: true };
}

/** Anyone may PATCH a project, so this key may hold anything at all. */
export function hasProvisionalName(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.[PROVISIONAL_NAME] === true;
}

export function withoutProvisionalName(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  delete next[PROVISIONAL_NAME];
  return next;
}
