import { icons } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import TooltipButton from "../../Buttons/TooltipButton";

interface SelectionToolbarProps {
  onCopy?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUpgrade?: () => void;
  onGroup?: () => void;
}

const SelectionToolbar = ({
  onCopy,
  onDuplicate,
  onDelete,
  onUpgrade,
  onGroup,
}: SelectionToolbarProps) => {
  return (
    <InlineStack
      gap="1"
      className="bg-white border border-[#0059dc66] border-b-0 rounded-xs"
    >
      <ToolbarButton
        name="Update Tasks"
        callback={onUpgrade}
        icon="CircleFadingArrowUp"
      />
      <ToolbarButton
        name="Create Subgraph"
        callback={onGroup}
        icon="Workflow"
      />
      <ToolbarButton
        name="Duplicate Nodes"
        callback={onDuplicate}
        icon="Copy"
      />
      <ToolbarButton name="Copy Yaml" callback={onCopy} icon="ClipboardPlus" />
      <ToolbarButton
        name="Delete All"
        callback={onDelete}
        icon="Trash"
        dangerous
      />
    </InlineStack>
  );
};

export default SelectionToolbar;

const ToolbarButton = ({
  name,
  icon,
  dangerous,
  callback,
}: {
  name: string;
  icon: keyof typeof icons;
  dangerous?: boolean;
  callback?: () => void;
}) => {
  if (!callback) {
    return null;
  }

  const baseStyle = "h-full aspect-square w-min rounded-sm p-1";

  return (
    <TooltipButton
      tooltip={name}
      className={cn(baseStyle, {
        "text-destructive hover:text-destructive": dangerous,
      })}
      variant="ghost"
      onClick={callback}
      size="icon"
    >
      <Icon name={icon} className="p-0.5" />
    </TooltipButton>
  );
};
