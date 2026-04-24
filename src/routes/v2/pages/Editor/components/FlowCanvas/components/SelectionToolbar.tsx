import type { icons } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { CreateSubgraphForm } from "@/routes/v2/pages/Editor/components/CreateSubgraphForm";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

interface SelectionToolbarProps {
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste?: () => void;
  onDelete: () => void;
  onCreateSubgraph?: (name: string) => void;
  selectedTaskCount?: number;
}

export const SelectionToolbar = observer(function SelectionToolbar({
  onDuplicate,
  onCopy,
  onPaste,
  onDelete,
  onCreateSubgraph,
  selectedTaskCount = 0,
}: SelectionToolbarProps) {
  const { clipboard } = useEditorSession();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleCreate = (name: string) => {
    if (!onCreateSubgraph) return;
    onCreateSubgraph(name);
    setPopoverOpen(false);
  };

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
      {clipboard.hasContent && onPaste && (
        <ToolbarButton
          label="Paste"
          icon="ClipboardPaste"
          onClick={onPaste}
          testId="selection-paste"
        />
      )}
      {onCreateSubgraph && selectedTaskCount >= 2 && (
        <>
          <Separator orientation="vertical" className="mx-0.5 self-stretch" />
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <div>
                <ToolbarButton
                  label="Create Subgraph"
                  icon="Layers"
                  onClick={() => setPopoverOpen(true)}
                  testId="selection-create-subgraph"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-64">
              <CreateSubgraphForm
                selectedTaskCount={selectedTaskCount}
                onSubmit={handleCreate}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </>
      )}
      <Separator orientation="vertical" className="mx-0.5 self-stretch" />
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
