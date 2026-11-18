import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

export function PrivateRepositoryBadge() {
  return (
    <Badge size="sm" variant="secondary">
      <Icon name="Lock" size="xs" />
      Private
    </Badge>
  );
}
