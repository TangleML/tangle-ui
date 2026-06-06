import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { LINEAGE_ORIGIN_ANNOTATION } from "@/utils/lineage";

/**
 * Modal shown after pasting or duplicating a task that had no lineage, when the
 * source task is still in the current pipeline. The pasted copy has already been
 * auto-stamped with a fresh origin id. The user can optionally check "Track
 * changes to the original" to back-link the source task to the same origin so
 * edits to either will offer to update the other.
 *
 * Shown only for same-pipeline operations — cross-pipeline source tasks won't
 * be found in the current spec, so no modal fires for those.
 */
export const PasteLineagePrompt = observer(function PasteLineagePrompt() {
  const spec = useSpec();
  const { clipboard, undo } = useEditorSession();
  const ctx = clipboard.latestPasteContext;

  const [track, setTrack] = useState(false);

  if (!ctx || !spec) return null;

  // Find pairs where the source exists in the current spec but has no lineage,
  // and the new task was freshly stamped. These are the linkable candidates.
  const candidates = [...ctx.idMap.entries()].flatMap(
    ([sourceEntityId, newTaskId]) => {
      const sourceTask = spec.tasks.find((t) => t.$id === sourceEntityId);
      const newTask = spec.tasks.find((t) => t.$id === newTaskId);
      if (!sourceTask || !newTask) return [];
      if (sourceTask.annotations.has(LINEAGE_ORIGIN_ANNOTATION)) return [];
      const lineage = newTask.annotations.get(LINEAGE_ORIGIN_ANNOTATION);
      if (!lineage) return [];
      return [{ sourceTask, newTaskId, originId: lineage.originId }];
    },
  );

  if (candidates.length === 0) return null;

  const sourceNames =
    candidates.length === 1
      ? `"${candidates[0].sourceTask.name}"`
      : `${candidates.length} tasks`;

  const handleDone = () => {
    if (track) {
      undo.withGroup("Link task lineage", () => {
        for (const { sourceTask, originId } of candidates) {
          sourceTask.annotations.set(LINEAGE_ORIGIN_ANNOTATION, {
            originId,
            originDigest: sourceTask.componentRef.digest,
            originName: sourceTask.componentRef.name,
          });
        }
      });
    }
    clipboard.clearPasteContext();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) clipboard.clearPasteContext();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track changes to the original?</DialogTitle>
          <DialogDescription>
            You pasted a copy of {sourceNames}. If you track it, edits to either
            the original or the copy will offer to update the other.
          </DialogDescription>
        </DialogHeader>

        <BlockStack gap="4">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent select-none">
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={track}
              onCheckedChange={(val) => setTrack(val === true)}
            />
            <BlockStack gap="1">
              <Text size="sm" weight="semibold">
                Track changes to {sourceNames}
              </Text>
              <Text size="xs" tone="subdued">
                Link the original and this copy so edits to either will offer to
                update the other.
              </Text>
            </BlockStack>
          </label>
        </BlockStack>

        <DialogFooter>
          <Button onClick={handleDone}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
