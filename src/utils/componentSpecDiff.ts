/**
 * Shared component input/output diffing, used by both the legacy and v2
 * editors to show users what an edited component definition changed.
 *
 * The implementation is intentionally portable (plain Map/filter, no
 * `Set.prototype.difference`/`.intersection`) so it runs on every Node version
 * the test suite uses, not just browsers.
 */

export interface EntityDiff<T> {
  lostEntities: T[];
  newEntities: T[];
  changedEntities: T[];
}

const EMPTY_DIFF: EntityDiff<never> = {
  lostEntities: [],
  newEntities: [],
  changedEntities: [],
};

/**
 * Diffs two name-keyed entity lists. Entries present before but not after are
 * "lost"; present after but not before are "new"; present in both but not
 * `isEqual` are "changed". Order follows the input arrays.
 */
export function computeEntityDiff<T extends { name: string }>(
  prevEntities: readonly T[] | undefined,
  currentEntities: readonly T[] | undefined,
  isEqual: (oldEntity: T, newEntity: T) => boolean,
): EntityDiff<T> {
  if (!prevEntities || !currentEntities) {
    return { ...EMPTY_DIFF };
  }

  const prevByName = new Map(prevEntities.map((e) => [e.name, e]));
  const currByName = new Map(currentEntities.map((e) => [e.name, e]));

  const lostEntities = prevEntities.filter((e) => !currByName.has(e.name));
  const newEntities = currentEntities.filter((e) => !prevByName.has(e.name));
  const changedEntities = currentEntities.filter((e) => {
    const prev = prevByName.get(e.name);
    return prev !== undefined && !isEqual(prev, e);
  });

  return { lostEntities, newEntities, changedEntities };
}

type IOEntity = { name: string; type?: unknown };
type ComponentIO<I extends IOEntity, O extends IOEntity> = {
  inputs?: readonly I[];
  outputs?: readonly O[];
};

/**
 * Diffs the inputs and outputs of two component specs. Inputs/outputs are
 * considered "changed" when their `type` differs. Works structurally against
 * both the legacy (`@/utils/componentSpec`) and v2 model spec shapes.
 */
export function diffComponentIO<I extends IOEntity, O extends IOEntity>(
  oldIO: ComponentIO<I, O> | undefined,
  newIO: ComponentIO<I, O> | undefined,
): { inputDiff: EntityDiff<I>; outputDiff: EntityDiff<O> } {
  return {
    inputDiff: computeEntityDiff(
      oldIO?.inputs,
      newIO?.inputs,
      (a, b) => a.type === b.type,
    ),
    outputDiff: computeEntityDiff(
      oldIO?.outputs,
      newIO?.outputs,
      (a, b) => a.type === b.type,
    ),
  };
}

/** True when either diff contains any lost, new, or changed entity. */
function hasEntityChanges(diff: EntityDiff<unknown>): boolean {
  return (
    diff.lostEntities.length > 0 ||
    diff.newEntities.length > 0 ||
    diff.changedEntities.length > 0
  );
}

/** True when the input or output diff contains any change. */
export function hasIODiff(
  inputDiff: EntityDiff<unknown>,
  outputDiff: EntityDiff<unknown>,
): boolean {
  return hasEntityChanges(inputDiff) || hasEntityChanges(outputDiff);
}
