export interface ShortcutKeys {
  mod: boolean;
  shift?: boolean;
  key: string;
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function matchesShortcut(
  event: KeyboardEvent,
  keys: ShortcutKeys,
): boolean {
  const modPressed = event.metaKey || event.ctrlKey;
  if (keys.mod && !modPressed) return false;
  if (!keys.mod && modPressed) return false;
  if (keys.shift && !event.shiftKey) return false;
  if (!keys.shift && event.shiftKey) return false;
  return event.key.toLowerCase() === keys.key.toLowerCase();
}

/**
 * Returns a platform-aware display string for a shortcut.
 * On macOS uses symbols; on other platforms uses "Ctrl+".
 */
export function formatShortcut(keys: ShortcutKeys): string {
  const parts: string[] = [];

  if (keys.mod) {
    parts.push(isMac ? "\u2318" : "Ctrl");
  }
  if (keys.shift) {
    parts.push(isMac ? "\u21E7" : "Shift");
  }

  const keyLabel = keys.key.length === 1 ? keys.key.toUpperCase() : keys.key;
  parts.push(keyLabel);

  return isMac ? parts.join("") : parts.join("+");
}
