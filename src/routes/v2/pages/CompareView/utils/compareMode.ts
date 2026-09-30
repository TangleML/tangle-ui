/**
 * Which runs the comparison page currently has. `single` carries the side that
 * is filled in, so views never have to guess it back out of the run data.
 */
export type CompareMode =
  | { kind: "empty" }
  | { kind: "single"; side: "a" | "b" }
  | { kind: "both" };

/**
 * The same run in both slots counts as one selection, not a comparison: a run
 * diffed against itself has nothing to show.
 */
export function compareMode(runIdA: string, runIdB: string): CompareMode {
  if (runIdA && runIdB && runIdA !== runIdB) return { kind: "both" };
  if (runIdA) return { kind: "single", side: "a" };
  if (runIdB) return { kind: "single", side: "b" };
  return { kind: "empty" };
}
