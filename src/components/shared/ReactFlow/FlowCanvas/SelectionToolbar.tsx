import { icons } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

interface SelectionToolbarProps {
  onCopy?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUpgrade?: () => void;
}

const SelectionToolbar = ({
  onCopy,
  onDuplicate,
  onDelete,
  onUpgrade,
}: SelectionToolbarProps) => {
  return (
    <InlineStack
      gap="1"
      blockAlign="center"
      className="bg-white border border-[#0059dc66] border-b-0 rounded-xs"
    >
      <ToolbarButton callback={onUpgrade} icon="CircleFadingArrowUp" />
      <ToolbarButton callback={onDuplicate} icon="Copy" />
      <ToolbarButton callback={onCopy} icon="ClipboardPlus" />
      <ToolbarButton callback={onDelete} icon="Trash" dangerous />
    </InlineStack>
  );
};

export default SelectionToolbar;

const ToolbarButton = ({
  icon,
  dangerous,
  callback,
}: {
  icon: keyof typeof icons;
  dangerous?: boolean;
  callback?: () => void;
}) => {
  if (!callback) {
    return null;
  }

  const baseStyle = "h-full aspect-square w-min rounded-sm p-1";

  return (
    <Button
      className={cn(baseStyle, {
        "text-destructive hover:text-destructive": dangerous,
      })}
      variant="ghost"
      onClick={callback}
      size="icon"
    >
      <Icon name={icon} className="p-0.5" />
    </Button>
  );
};
