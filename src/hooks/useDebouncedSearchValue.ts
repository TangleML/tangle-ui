import { useEffect, useRef, useState } from "react";

const SEARCH_QUERY_DEBOUNCE_MS = 200;

/**
 * Local, controlled input value that commits to `onCommit` only after the user
 * pauses typing for `delayMs`. The `<input>` renders from this local state —
 * decoupled from the parent's potentially-expensive search render — so it stays
 * responsive, while the downstream search runs at most once per debounce window.
 *
 * Own URL echoes leave the draft intact. `resetValue` cancels pending edits for
 * explicit clears or history navigation; `shouldSyncExternalValue` can also
 * preserve focused drafts when a parent normalizes committed values.
 */
export function useDebouncedSearchValue(
  onCommit: (value: string) => void,
  delayMs: number = SEARCH_QUERY_DEBOUNCE_MS,
  initialValue?: string,
  shouldSyncExternalValue: () => boolean = () => true,
): readonly [string, (value: string) => void, (value: string) => void] {
  const [localValue, setLocalValue] = useState(initialValue ?? "");
  const hasExternalValue = initialValue !== undefined;
  // Keep the latest callback without re-running the debounce effect when the
  // parent passes a new function identity on each render.
  const onCommitRef = useRef(onCommit);
  const shouldSyncExternalValueRef = useRef(shouldSyncExternalValue);
  const lastCommittedRef = useRef(initialValue ?? "");
  const pendingCommitsRef = useRef(new Set<string>());
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    shouldSyncExternalValueRef.current = shouldSyncExternalValue;
  }, [shouldSyncExternalValue]);

  useEffect(() => {
    if (initialValue === undefined) return;
    if (pendingCommitsRef.current.delete(initialValue)) {
      if (initialValue === lastCommittedRef.current)
        pendingCommitsRef.current.clear();
      return;
    }
    if (initialValue === lastCommittedRef.current) return;
    lastCommittedRef.current = initialValue;
    pendingCommitsRef.current.clear();
    if (!shouldSyncExternalValueRef.current()) return;
    window.clearTimeout(timeoutRef.current);
    setLocalValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (localValue === lastCommittedRef.current) return;
    const timeout = window.setTimeout(() => {
      lastCommittedRef.current = localValue;
      if (hasExternalValue) pendingCommitsRef.current.add(localValue);
      onCommitRef.current(localValue);
    }, delayMs);
    timeoutRef.current = timeout;
    return () => window.clearTimeout(timeout);
  }, [localValue, delayMs, hasExternalValue]);

  function resetValue(value: string) {
    window.clearTimeout(timeoutRef.current);
    pendingCommitsRef.current.clear();
    lastCommittedRef.current = value;
    setLocalValue(value);
  }

  return [localValue, setLocalValue, resetValue] as const;
}
