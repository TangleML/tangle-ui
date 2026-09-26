interface Labelable {
  createdAt: Date;
  name?: string | null;
}

const sessionLabel = (ordinal: number) => `Session ${ordinal}`;

/**
 * Numbered in the order they were started, so the first session a project ever
 * had stays "Session 1" however many follow. Both the project page and Tangent
 * number from here, or the same session is called two things.
 *
 * Named sessions go by their name, and the numbering skips them rather than
 * closing the gap, so naming one does not renumber the others.
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
