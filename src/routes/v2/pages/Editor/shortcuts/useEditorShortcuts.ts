import { useEffect } from "react";

import { normalizeKeyFromEvent } from "@/routes/v2/shared/shortcuts/keys";
import { keyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { isEditableTarget } from "./shortcutUtils";

/**
 * Single keydown/keyup/blur listener that tracks pressed keys in
 * `keyboardStore.pressed` and dispatches registered shortcuts.
 * Call once at the EditorV2 root level.
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = normalizeKeyFromEvent(event);
      if (key) keyboardStore.pressKey(key);

      const editable = isEditableTarget(event.target);

      for (const shortcut of keyboardStore.shortcuts.values()) {
        if (editable && !shortcut.allowInEditable) continue;
        if (keyboardStore.matchesPressed(shortcut.keys)) {
          event.preventDefault();
          /**
           * In MacOS only one keyup event triggers when Meta key is pressed
           * @see https://web.archive.org/web/20160304022453/http://bitspushedaround.com/on-a-few-things-you-may-not-know-about-the-hellish-command-key-and-javascript-events/
           */
          keyboardStore.clearPressed();
          shortcut.action(event);
          return;
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = normalizeKeyFromEvent(event);
      if (key) keyboardStore.releaseKey(key);
    };

    const handleBlur = () => {
      keyboardStore.clearPressed();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      keyboardStore.clearPressed();
    };
  }, []);
}
