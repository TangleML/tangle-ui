import { type RefObject, useEffect } from "react";

const listeners = new Set<() => void>();
let pending = false;

/**
 * Asks the project card to put the cursor in its search. A card that isn't on
 * screen yet, such as one in a closed popover, takes it as soon as it shows.
 */
export function requestProjectSearchFocus(): void {
  if (listeners.size === 0) {
    pending = true;
    return;
  }
  for (const focus of listeners) focus();
}

/** Focuses `input` whenever {@link requestProjectSearchFocus} asks. */
export function useProjectSearchFocus(
  input: RefObject<HTMLInputElement | null>,
): void {
  useEffect(() => {
    const focus = () => input.current?.focus();
    listeners.add(focus);
    if (pending) {
      pending = false;
      focus();
    }
    return () => {
      listeners.delete(focus);
    };
  }, [input]);
}
