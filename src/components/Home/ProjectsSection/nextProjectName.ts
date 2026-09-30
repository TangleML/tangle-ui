const PREFIX = "Project";

/**
 * Projects started from a prompt are named by position, not by what was asked
 * for: a prompt is a paragraph, and a whole paragraph as a title reads as a
 * mistake everywhere the name is shown.
 *
 * Names are not unique on the backend, and only the projects already loaded
 * are known here, so this picks the lowest free number among those rather than
 * guaranteeing one.
 */
export function nextProjectName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  for (let ordinal = 1; ; ordinal++) {
    const candidate = `${PREFIX} ${ordinal}`;
    if (!taken.has(candidate)) return candidate;
  }
}
