import equal from "fast-deep-equal";
import { useCallback, useEffect, useRef } from "react";

import { deepClone } from "@/utils/deepClone";

interface UseDebouncedStateOptions {
  debounceMs?: number;
}
export function useDebouncedState<T>(
  currentState: T,
  onStateChange: (state: T) => void,
  shouldIgnoreChange: () => boolean,
  options: UseDebouncedStateOptions = {},
) {
  const { debounceMs = 500 } = options;

  const previousStateRef = useRef<T>(deepClone(currentState));
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const updatePreviousState = useCallback((newState: T) => {
    previousStateRef.current = deepClone(newState);
  }, []);

  useEffect(() => {
    const shouldIgnore = shouldIgnoreChange();
    const isEqual = equal(currentState, previousStateRef.current);

    if (shouldIgnore) {
      return;
    }

    if (isEqual) {
      return;
    }

    clearDebounce();

    debounceTimeoutRef.current = setTimeout(() => {
      onStateChange(currentState);
      previousStateRef.current = deepClone(currentState);
      debounceTimeoutRef.current = null;
    }, debounceMs);

    return clearDebounce;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentState, debounceMs, onStateChange, shouldIgnoreChange]);

  return { clearDebounce, updatePreviousState };
}
