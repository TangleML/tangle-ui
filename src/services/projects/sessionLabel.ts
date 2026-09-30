interface Datable {
  createdAt: Date;
}

const sessionLabel = (ordinal: number) => `Session ${ordinal}`;

/**
 * Sessions are numbered in the order they were started, so the first one a
 * project ever had stays "Session 1" however many follow it. Both the list on
 * the project page and the one in Tangent number from here so the same session
 * is called the same thing in both places.
 */
export function sessionLabelsById<T extends Datable>(
  sessions: ReadonlyMap<string, T> | ReadonlyArray<[string, T]>,
): Map<string, string> {
  const entries = Array.isArray(sessions) ? sessions : [...sessions];

  return new Map(
    [...entries]
      .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(([id], index) => [id, sessionLabel(index + 1)]),
  );
}
