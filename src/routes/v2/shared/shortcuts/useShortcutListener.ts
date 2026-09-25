import { useEffect } from "react";

import {
  CMDALT,
  normalizeKeyFromEvent,
} from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { isEditableTarget } from "./shortcutUtils";

/**
 * Single keydown/keyup/blur listener that tracks pressed keys in
 * `keyboard.pressed` and dispatches registered shortcuts.
 * Call once at the root layout level (Editor, RunView, etc.).
 *
 * The workarea mounts one editor per tab, each with its own store, so several
 * of these can exist at once and a keystroke would reach every one. Pass
 * `enabled` to let only the tab the person is looking at dispatch.
 */
export function useShortcutListener(enabled = true): void {
  const { keyboard } = useSharedStores();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat && event.metaKey) return;

      keyboard.syncModifiers(event);
      if (event.metaKey) {
        keyboard.clearNonModifierKeys();
      }

      const keys = normalizeKeyFromEvent(event);
      for (const key of keys) {
        keyboard.pressKey(key);
      }

      const editable = isEditableTarget(event.target);

      for (const shortcut of keyboard.shortcuts.values()) {
        if (editable && !shortcut.allowInEditable) continue;
        if (!keyboard.matchesPressed(shortcut.keys)) continue;

        const handled = shortcut.action(event);
        keyboard.clearPressed();

        if (handled === false) {
          break;
        }
        event.preventDefault();
        return;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const keys = normalizeKeyFromEvent(event);
      if (keys.includes(CMDALT)) {
        keyboard.clearPressed();
        return;
      }

      for (const key of keys) {
        keyboard.releaseKey(key);
      }
    };

    const handleBlur = () => {
      keyboard.clearPressed();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      keyboard.clearPressed();
    };
  }, [keyboard, enabled]);
}
