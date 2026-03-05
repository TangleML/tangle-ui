import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface TagProps {
  tag: string;
  onEdit: () => void;
  onRemove: () => void;
}

export const Tag = ({ tag, onEdit, onRemove }: TagProps) => (
  <Badge
    size="sm"
    shape="rounded"
    variant="outline"
    className="has-[button:hover]:opacity-100 cursor-pointer hover:opacity-80"
    onClick={onEdit}
  >
    {tag}
    <Button
      size="min"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className="rounded-full p-0.5 hover:text-destructive hover:bg-transparent"
    >
      <Icon name="X" size="sm" />
    </Button>
  </Badge>
);
