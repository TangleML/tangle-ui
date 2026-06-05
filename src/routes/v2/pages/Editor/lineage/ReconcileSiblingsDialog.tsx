import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import type { LineageUsage } from "./collectLineageUsages";

interface ReconcileSiblingsDialogProps {
  componentName: string;
  matches: LineageUsage[];
  onConfirm: (taskIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Shown after an in-place component edit when other tasks in the pipeline share
 * the same component origin. Offers to update the matching tasks to the edited
 * version too, with per-task selection. Mounted only while active, so selection
 * state resets for each prompt.
 */
export function ReconcileSiblingsDialog({
  componentName,
  matches,
  onConfirm,
  onCancel,
}: ReconcileSiblingsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(matches.map((m) => m.taskId)),
  );

  const toggle = (taskId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const count = selected.size;

  return (
    <AlertDialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update matching tasks?</AlertDialogTitle>
          <AlertDialogDescription>
            {matches.length} other{" "}
            {matches.length === 1 ? "task uses" : "tasks use"} the same origin
            as “{componentName}”. Update {matches.length === 1 ? "it" : "them"}{" "}
            to your edited version too? Inputs or outputs that no longer exist
            will be removed, along with their connections.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <BlockStack gap="1" className="max-h-64 overflow-y-auto py-1">
          {matches.map((match) => (
            <label
              key={match.taskId}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={selected.has(match.taskId)}
                onCheckedChange={(checked) =>
                  toggle(match.taskId, checked === true)
                }
              />
              <span className="flex min-w-0 flex-col">
                <Text size="sm" className="truncate">
                  {match.taskName}
                </Text>
                {match.subgraphPath.length > 0 && (
                  <InlineStack gap="1" blockAlign="center">
                    <Icon
                      name="Workflow"
                      size="xs"
                      className="shrink-0 text-muted-foreground"
                    />
                    <Text size="xs" tone="subdued" className="truncate">
                      {match.subgraphPath.join(" / ")}
                    </Text>
                  </InlineStack>
                )}
              </span>
            </label>
          ))}
        </BlockStack>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Not now</AlertDialogCancel>
          <AlertDialogAction
            disabled={count === 0}
            onClick={() => onConfirm([...selected])}
          >
            Update {count} {count === 1 ? "task" : "tasks"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
