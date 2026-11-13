import { useEffect } from "react";

import { requestProjectSearchFocus } from "@/routes/v2/pages/Tangent/hooks/useProjectSearchFocus";
import { PROJECT_CARD_WINDOW_ID } from "@/routes/v2/pages/Tangent/hooks/useTangentProjectWindows";
import { IS_MAC } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

export const FIND_PROJECT_CARD_SHORTCUT = IS_MAC ? "⌘K" : "Ctrl+K";

function isShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.shiftKey) return false;
  if (!(IS_MAC ? event.metaKey : event.ctrlKey)) return false;
  return event.key.toLowerCase() === "k";
}

/** Shows the card wherever it is: unfolded, and in front if it floats. */
function revealProjectCard(windows: WindowStoreImpl): void {
  const card = windows.getWindowById(PROJECT_CARD_WINDOW_ID);
  if (!card) return;
  if (card.state === "hidden" || card.isMinimized) card.restore();
  if (card.dockState === "none") {
    card.bringToFront();
    return;
  }
  if (card.dockState === "left") {
    windows.setDockAreaCollapsed("left", false);
    return;
  }
  windows.setDockPopoverOpen(card.dockState, true);
}

/**
 * ⌘K (Ctrl+K) finds the project card from anywhere on the page, the chat box
 * included, and puts the cursor in its search. With the card in the popover it
 * opens and closes it; in the left dock it unfolds it; floating, it brings it
 * to the front. An open dialog keeps the key for itself.
 */
export function useFindProjectCard() {
  const { windows } = useSharedStores();

  useEffect(() => {
    const find = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      const card = windows.getWindowById(PROJECT_CARD_WINDOW_ID);
      if (!card) return;
      if (card.dockState === "right" && windows.isDockPopoverOpen("right")) {
        event.preventDefault();
        windows.setDockPopoverOpen("right", false);
        return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      revealProjectCard(windows);
      requestProjectSearchFocus();
    };
    window.addEventListener("keydown", find);
    return () => window.removeEventListener("keydown", find);
  }, [windows]);
}
