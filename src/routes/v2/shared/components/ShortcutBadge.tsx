import { observer } from "mobx-react-lite";

import { Badge } from "@/components/ui/badge";
import {
  CMD_OR_CTRL,
  CTRL,
  type KeyConstant,
  SHIFT,
} from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export const ShortcutBadge = observer(function ShortcutBadge({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const { keyboard } = useSharedStores();
  const shortcut = keyboard.getShortcut(id);

  if (!shortcut) return null;

  return (
    <Badge variant="outline" className={className}>
      {formatShortcut(shortcut.keys, keyboard.isMac)}
    </Badge>
  );
});

/**
 * Returns a platform-aware display string for a shortcut.
 * On macOS uses symbols; on other platforms uses "Ctrl+".
 */
export function formatShortcut(keys: KeyConstant[], isMac: boolean): string {
  const parts: string[] = [];

  for (const key of keys) {
    switch (key) {
      case CMD_OR_CTRL:
        parts.push(isMac ? "\u2318" : "Ctrl");
        break;
      case CTRL:
        parts.push(isMac ? "\u2303" : "Ctrl");
        break;
      case SHIFT:
        parts.push(isMac ? "\u21E7" : "Shift");
        break;
      default: {
        const label = key.length === 1 ? key.toUpperCase() : key;
        parts.push(label);
      }
    }
  }

  return isMac ? parts.join(" ") : parts.join("+");
}
