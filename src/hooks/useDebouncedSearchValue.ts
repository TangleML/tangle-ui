import { useEffect, useRef, useState } from "react";

/** Default debounce window for search inputs, in milliseconds. */
const SEARCH_QUERY_DEBOUNCE_MS = 200;

/**
 * Local, controlled input value that commits to `onCommit` only after the user
 * pauses typing for `delayMs`. The `<input>` renders from this local state —
 * decoupled from the parent's potentially-expensive search render — so it stays
 * responsive, while the downstream search runs at most once per debounce window.
 *
 * Returns `[localValue, setLocalValue]` for the input to bind to. The commit is
 * skipped while the value still matches what was last committed, so it never
 * fires a no-op commit on mount. `shouldSyncExternalValue` can block URL echo
 * updates while the input is focused, keeping typing independent from routing.
 */
export function useDebouncedSearchValue(
  onCommit: (value: string) => void,
  delayMs: number = SEARCH_QUERY_DEBOUNCE_MS,
  initialValue: string = "",
  shouldSyncExternalValue: () => boolean = () => true,
): readonly [string, (value: string) => void] {
  const [localValue, setLocalValue] = useState(initialValue);
  // Keep the latest callback without re-running the debounce effect when the
  // parent passes a new function identity on each render.
  const onCommitRef = useRef(onCommit);
  const shouldSyncExternalValueRef = useRef(shouldSyncExternalValue);
  const lastCommittedRef = useRef(initialValue);
  const skipNextCommitRef = useRef(false);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    shouldSyncExternalValueRef.current = shouldSyncExternalValue;
  }, [shouldSyncExternalValue]);

  useEffect(() => {
    if (initialValue === lastCommittedRef.current) return;
    lastCommittedRef.current = initialValue;
    if (!shouldSyncExternalValueRef.current()) return;
    skipNextCommitRef.current = true;
    setLocalValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (skipNextCommitRef.current) {
      skipNextCommitRef.current = false;
      return;
    }
    if (localValue === lastCommittedRef.current) return;
    const timeout = window.setTimeout(() => {
      lastCommittedRef.current = localValue;
      onCommitRef.current(localValue);
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [localValue, delayMs]);

  return [localValue, setLocalValue] as const;
}
