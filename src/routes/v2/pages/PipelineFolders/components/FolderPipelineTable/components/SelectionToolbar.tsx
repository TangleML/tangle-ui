import type { ReactNode } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { FloatingSelectionBar } from "@/components/shared/FloatingSelectionBar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { pluralize } from "@/utils/string";
import { tracking } from "@/utils/tracking";

interface SelectionToolbarProps {
  totalSelected: number;
  canMove?: boolean;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
  children?: ReactNode;
}

export function SelectionToolbar({
  totalSelected,
  canMove = true,
  onMove,
  onDelete,
  onClear,
  isDeleting,
  children,
}: SelectionToolbarProps) {
  return (
    <FloatingSelectionBar
      count={totalSelected}
      itemNoun="item"
      onClear={onClear}
      clearTrackingId="v2.pipeline_folders.table.selection_clear"
    >
      {children}
      {canMove && (
        <Button
          variant="outline"
          size="sm"
          onClick={onMove}
          {...tracking("v2.pipeline_folders.table.selection_move")}
        >
          <Icon name="FolderInput" />
          Move
        </Button>
      )}
      <ConfirmationDialog
        trigger={
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            {...tracking(
              "v2.pipeline_folders.table.selection_bulk_delete_open",
            )}
          >
            <Icon name="Trash2" />
            Delete
          </Button>
        }
        title={`Delete ${totalSelected} ${pluralize(totalSelected, "item")}?`}
        description="Are you sure? Pipelines runs will not be impacted. Deleted folders will have their contents moved to root. This action cannot be undone."
        onConfirm={onDelete}
      />
    </FloatingSelectionBar>
  );
}
