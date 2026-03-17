export const CMDALT = "CMDALT" as const;
export const CTRL = "CTRL" as const;
export const SHIFT = "SHIFT" as const;

export const ESCAPE = "ESCAPE" as const;
const DELETE = "DELETE" as const;
const BACKSPACE = "BACKSPACE" as const;
const ENTER = "ENTER" as const;
const SPACE = "SPACE" as const;
const TAB = "TAB" as const;

export type ModifierKey = typeof CMDALT | typeof CTRL | typeof SHIFT;

export type SpecialKey =
  | typeof ESCAPE
  | typeof DELETE
  | typeof BACKSPACE
  | typeof ENTER
  | typeof SPACE
  | typeof TAB;

export type KeyConstant = ModifierKey | SpecialKey | string;

const SPECIAL_KEY_MAP: Record<string, KeyConstant> = {
  Meta: CMDALT,
  Control: CTRL,
  Alt: CMDALT,
  Shift: SHIFT,
  Escape: ESCAPE,
  Delete: DELETE,
  Backspace: BACKSPACE,
  Enter: ENTER,
  " ": SPACE,
  Tab: TAB,
};

/**
 * Maps a raw `KeyboardEvent.key` value to the canonical KeyConstant.
 * Returns `null` for keys we don't track (e.g. dead keys, CapsLock).
 */
export function normalizeKeyFromEvent(
  event: KeyboardEvent,
): KeyConstant | null {
  const mapped = SPECIAL_KEY_MAP[event.key];
  if (mapped) return mapped;

  if (event.key.length === 1) return event.key.toUpperCase();

  return null;
}

/**
 * Canonical ordering: CMDALT < CTRL < SHIFT < everything else (alphabetical).
 * Used to build the combo-key string for the shortcuts map.
 */
const KEY_ORDER: Record<string, number> = {
  [CMDALT]: 0,
  [CTRL]: 1,
  [SHIFT]: 2,
};

export function normalizeComboKey(keys: KeyConstant[]): string {
  return [...keys]
    .sort(
      (a, b) =>
        (KEY_ORDER[a] ?? 99) - (KEY_ORDER[b] ?? 99) || a.localeCompare(b),
    )
    .join("+");
}
