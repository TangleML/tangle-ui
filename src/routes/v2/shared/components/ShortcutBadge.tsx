import { observer } from "mobx-react-lite";

import { Badge } from "@/components/ui/badge";
import {
  CMDALT,
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
      {formatShortcut(shortcut.keys)}
    </Badge>
  );
});

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
/**
 * Returns a platform-aware display string for a shortcut.
 * On macOS uses symbols; on other platforms CMDALT is Alt because the
 * shortcut listener maps Alt, not Ctrl, to that modifier.
 */
export function formatShortcut(
  keys: KeyConstant[],
  platformIsMac = isMac,
): string {
  const parts: string[] = [];

  for (const key of keys) {
    switch (key) {
      case CMDALT:
        parts.push(platformIsMac ? "\u2318" : "Alt");
        break;
      case SHIFT:
        parts.push(platformIsMac ? "\u21E7" : "Shift");
        break;
      default: {
        const label = key.length === 1 ? key.toUpperCase() : key;
        parts.push(label);
      }
    }
  }

  return platformIsMac ? parts.join(" ") : parts.join("+");
}
