import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

export function TourCompletedBadge() {
  return (
    <Badge size="sm" variant="outline" className="text-green-600">
      <Icon name="Check" size="xs" aria-hidden="true" />
      Completed
    </Badge>
  );
}
