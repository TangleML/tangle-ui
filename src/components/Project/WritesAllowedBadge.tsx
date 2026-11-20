import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import type { ListItemFlair } from "@/components/ui/list-item";

const WRITES_ALLOWED_LABEL = "Writes allowed";
const WRITES_ALLOWED_ICON: IconName = "PenLine";

export const writesAllowedFlair = (): ListItemFlair => ({
  kind: "badge",
  icon: WRITES_ALLOWED_ICON,
  label: WRITES_ALLOWED_LABEL,
});

export function WritesAllowedBadge() {
  return (
    <Badge size="sm" variant="secondary">
      <Icon name={WRITES_ALLOWED_ICON} size="xs" />
      {WRITES_ALLOWED_LABEL}
    </Badge>
  );
}
