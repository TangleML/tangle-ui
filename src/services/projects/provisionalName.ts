const PROVISIONAL_NAME = "provisionalName";

/**
 * Marks a project name as one nobody chose — derived from the opening prompt,
 * or numbered — so the agent may replace it once it knows what the project is
 * for. A name a human typed carries no mark and is left alone.
 *
 * The mark is dropped by whoever renames next, agent or human: the second name
 * was chosen deliberately by someone, which is the whole of what this asks.
 */
export function provisionalNameExtraData(
  extraData?: Record<string, unknown> | null,
): Record<string, unknown> {
  return { ...(extraData ?? {}), [PROVISIONAL_NAME]: true };
}

/** Anyone may PATCH a project, so this key may hold anything at all. */
export function hasProvisionalName(
  extraData: Record<string, unknown> | null | undefined,
): boolean {
  return extraData?.[PROVISIONAL_NAME] === true;
}

export function withoutProvisionalName(
  extraData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...(extraData ?? {}) };
  delete next[PROVISIONAL_NAME];
  return next;
}
