import type { icons } from "lucide-react";
import { observer } from "mobx-react-lite";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { clipboardStore } from "../../store/clipboardStore";

interface SelectionToolbarProps {
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste?: () => void;
  onDelete: () => void;
}

export const SelectionToolbar = observer(function SelectionToolbar({
  onDuplicate,
  onCopy,
  onPaste,
  onDelete,
}: SelectionToolbarProps) {
  return (
    <InlineStack
      gap="1"
      className="rounded-md border border-blue-200 bg-white px-1 py-1 shadow-lg"
      data-testid="selection-toolbar"
    >
      <ToolbarButton
        label="Duplicate"
        icon="Copy"
        onClick={onDuplicate}
        testId="selection-duplicate"
      />
      <ToolbarButton
        label="Copy"
        icon="ClipboardCopy"
        onClick={onCopy}
        testId="selection-copy"
      />
      {clipboardStore.hasContent && onPaste && (
        <ToolbarButton
          label="Paste"
          icon="ClipboardPaste"
          onClick={onPaste}
          testId="selection-paste"
        />
      )}
      <div className="mx-0.5 w-px self-stretch bg-gray-200" />
      <ToolbarButton
        label="Delete"
        icon="Trash2"
        onClick={onDelete}
        dangerous
        testId="selection-delete"
      />
    </InlineStack>
  );
});

function ToolbarButton({
  label,
  icon,
  onClick,
  dangerous,
  testId,
}: {
  label: string;
  icon: keyof typeof icons;
  onClick: () => void;
  dangerous?: boolean;
  testId?: string;
}) {
  return (
    <TooltipButton
      tooltip={label}
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 px-2", {
        "text-destructive hover:text-destructive": dangerous,
      })}
      onClick={onClick}
      data-testid={testId}
    >
      <Icon name={icon} size="sm" />
      <Text size="xs" weight="semibold">
        {label}
      </Text>
    </TooltipButton>
  );
}
