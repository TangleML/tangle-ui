interface Labelable {
  createdAt: Date;
  name?: string | null;
}

const sessionLabel = (ordinal: number) => `Session ${ordinal}`;

/**
 * Sessions are numbered in the order they were started, so the first one a
 * project ever had stays "Session 1" however many follow it. Both the list on
 * the project page and the one in Tangent number from here so the same session
 * is called the same thing in both places.
 *
 * A session that has been named — by the prompt that started it, or by the
 * agent once it knew what the conversation was about — goes by that name
 * instead. The numbering ignores the named ones rather than closing the gap,
 * so naming one session does not renumber the others.
 */
export function sessionLabelsById<T extends Labelable>(
  sessions: ReadonlyMap<string, T> | ReadonlyArray<[string, T]>,
): Map<string, string> {
  const entries = Array.isArray(sessions) ? sessions : [...sessions];

  return new Map(
    [...entries]
      .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(([id, session], index) => [
        id,
        session.name?.trim() || sessionLabel(index + 1),
      ]),
  );
}
