import type { icons } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { tracking } from "@/utils/tracking";

interface SelectionToolbarProps {
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onCreateSubgraph?: (name: string) => void;
  selectedTaskCount?: number;
}

export const SelectionToolbar = observer(function SelectionToolbar({
  onDuplicate,
  onCopy,
  onDelete,
  onCreateSubgraph,
  selectedTaskCount = 0,
}: SelectionToolbarProps) {
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
        trackingAction="v2.pipeline_canvas.selection_toolbar.duplicate"
      />
      <ToolbarButton
        label="Copy"
        icon="ClipboardCopy"
        onClick={onCopy}
        testId="selection-copy"
        trackingAction="v2.pipeline_canvas.selection_toolbar.copy"
      />
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
                  trackingAction="v2.pipeline_canvas.selection_toolbar.create_subgraph"
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
        trackingAction="v2.pipeline_canvas.selection_toolbar.delete"
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
  trackingAction,
}: {
  label: string;
  icon: keyof typeof icons;
  onClick: () => void;
  dangerous?: boolean;
  testId?: string;
  trackingAction: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 px-2", {
        "text-destructive hover:text-destructive": dangerous,
      })}
      onClick={onClick}
      data-testid={testId}
      {...tracking(trackingAction)}
    >
      <Icon name={icon} size="sm" />
      <Text size="xs" weight="semibold">
        {label}
      </Text>
    </Button>
  );
}
