export const CMDALT = "CMDALT" as const;
export const CTRL = "CTRL" as const;
export const SHIFT = "SHIFT" as const;

export const ESCAPE = "ESCAPE" as const;
const DELETE = "DELETE" as const;
const BACKSPACE = "BACKSPACE" as const;
const ENTER = "ENTER" as const;
const SPACE = "SPACE" as const;
const TAB = "TAB" as const;

type ModifierKey = typeof CMDALT | typeof CTRL | typeof SHIFT;

type SpecialKey =
  | typeof ESCAPE
  | typeof DELETE
  | typeof BACKSPACE
  | typeof ENTER
  | typeof SPACE
  | typeof TAB;

export type KeyConstant = ModifierKey | SpecialKey | string;

export const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

const MAC_MODIFIER_KEY_MAP: Record<string, KeyConstant> = {
  Meta: CMDALT,
  Control: CTRL,
};

const NON_MAC_MODIFIER_KEY_MAP: Record<string, KeyConstant> = {
  Control: CMDALT,
};

const SPECIAL_KEY_MAP: Record<string, KeyConstant> = {
  Shift: SHIFT,
  Escape: ESCAPE,
  Delete: DELETE,
  Backspace: BACKSPACE,
  Enter: ENTER,
  " ": SPACE,
  Tab: TAB,
};

/**
 * Maps a raw `KeyboardEvent.key` value to the canonical KeyConstants.
 * Returns an empty array for keys we don't track (e.g. dead keys, CapsLock).
 */
export function normalizeKeyFromEvent(
  event: KeyboardEvent,
  isMac: boolean,
): KeyConstant[] {
  const keys: KeyConstant[] = [];

  const modifierKeyMap = isMac
    ? MAC_MODIFIER_KEY_MAP
    : NON_MAC_MODIFIER_KEY_MAP;
  const mapped = modifierKeyMap[event.key] ?? SPECIAL_KEY_MAP[event.key];
  if (mapped) keys.push(mapped);

  if (event.key.length === 1) keys.push(event.key.toUpperCase());

  return keys;
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
