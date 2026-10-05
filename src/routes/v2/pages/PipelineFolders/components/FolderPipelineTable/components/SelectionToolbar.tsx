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
  canEnableCollaboration?: boolean;
  onEnableCollaboration?: () => void;
  isEnablingCollaboration?: boolean;
}

export function SelectionToolbar({
  totalSelected,
  canMove = true,
  onMove,
  onDelete,
  onClear,
  isDeleting,
  canEnableCollaboration = false,
  onEnableCollaboration,
  isEnablingCollaboration,
}: SelectionToolbarProps) {
  return (
    <FloatingSelectionBar
      count={totalSelected}
      itemNoun="item"
      onClear={onClear}
      clearTrackingId="v2.pipeline_folders.table.selection_clear"
    >
      {canEnableCollaboration && onEnableCollaboration && (
        <Button
          variant="outline"
          size="sm"
          disabled={isEnablingCollaboration}
          onClick={onEnableCollaboration}
          {...tracking("v2.pipeline_folders.table.enable_collaboration")}
        >
          <Icon name="Users" />
          Enable collaboration
        </Button>
      )}
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
