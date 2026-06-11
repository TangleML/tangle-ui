import { Badge } from "@/components/ui/badge";
import { IDEA_TYPE_LABELS } from "@/routes/tangent/labels";
import type { IdeaType } from "@/routes/tangent/types";

interface IdeaTypeChipProps {
  type: IdeaType;
}

export function IdeaTypeChip({ type }: IdeaTypeChipProps) {
  return (
    <Badge variant="outline" shape="rounded" size="sm">
      {IDEA_TYPE_LABELS[type]}
    </Badge>
  );
}
