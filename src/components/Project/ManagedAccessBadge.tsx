import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import type { ListItemFlair } from "@/components/ui/list-item";

import { writesAllowedFlair } from "./WritesAllowedBadge";

const MANAGED_ACCESS_ICON: IconName = "ShieldCheck";

export const managedAccessFlair = (label: string): ListItemFlair => ({
  kind: "badge",
  icon: MANAGED_ACCESS_ICON,
  label,
});

/**
 * A repository row has one flair. A link read through managed access that agents
 * may also write to shows both facts in it, managed access first.
 */
export function repositoryRowFlair({
  managedLabel,
  allowWrites,
}: {
  managedLabel: string | null;
  allowWrites: boolean | undefined;
}): ListItemFlair | undefined {
  if (managedLabel === null) {
    return allowWrites ? writesAllowedFlair() : undefined;
  }
  const managed = managedAccessFlair(managedLabel);
  return allowWrites
    ? { ...managed, label: `${managed.label} · ${writesAllowedFlair().label}` }
    : managed;
}

interface ManagedAccessBadgeProps {
  label: string;
}

export function ManagedAccessBadge({ label }: ManagedAccessBadgeProps) {
  return (
    <Badge size="sm" variant="secondary">
      <Icon name={MANAGED_ACCESS_ICON} size="xs" />
      {label}
    </Badge>
  );
}
