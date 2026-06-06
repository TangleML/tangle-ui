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
 * Modal shown when the user initiates a copy (Cmd+C / Copy button) and the
 * copied tasks have no lineage annotation. The clipboard write is deferred
 * until the user clicks "Copy". Checking the box stamps the source tasks with
 * a shared origin first, so any future paste — including cross-pipeline —
 * inherits the lineage and can participate in reconcile detection.
 *
 * Dismissing via ✕ or Escape completes the copy without tracking (same as
 * clicking "Copy" with the checkbox unchecked).
 */
export const CopyLineageModal = observer(function CopyLineageModal() {
  const spec = useSpec();
  const { clipboard } = useEditorSession();
  const ctx = clipboard.pendingCopyContext;

  const [track, setTrack] = useState(false);

  if (!ctx || !spec) return null;

  // Collect task names for display.
  const sourceNames = ctx.nodeIds
    .map((id) => spec.tasks.find((t) => t.$id === id)?.name)
    .filter(Boolean) as string[];

  const label =
    sourceNames.length === 1
      ? `"${sourceNames[0]}"`
      : `${sourceNames.length} tasks`;

  // Check which tasks actually still lack lineage (defensive — could have been
  // stamped by another operation since the copy was initiated).
  const hasAnyUnlinked = ctx.nodeIds.some((id) => {
    const task = spec.tasks.find((t) => t.$id === id);
    return task && !task.annotations.has(LINEAGE_ORIGIN_ANNOTATION);
  });

  if (!hasAnyUnlinked) {
    // All tasks are already linked — just commit the copy silently.
    clipboard.executeCopy(false, spec);
    return null;
  }

  const handleCopy = (shouldTrack: boolean) => {
    setTrack(false);
    clipboard.executeCopy(shouldTrack, spec);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // X / Escape / backdrop click → copy without tracking.
        if (!open) handleCopy(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy {label}</DialogTitle>
          <DialogDescription>
            Would you like to track changes between {label} and any copies you
            paste? Edits to either will offer to update the other.
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
                Track changes to {label}
              </Text>
              <Text size="xs" tone="subdued">
                Link the original and its copies so edits to either will offer
                to update the other — even across different pipelines.
              </Text>
            </BlockStack>
          </label>
        </BlockStack>

        <DialogFooter>
          <Button onClick={() => handleCopy(track)}>Copy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
