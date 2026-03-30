import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

interface SelectionToolbarProps {
  totalSelected: number;
  canMove?: boolean;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
}

export function SelectionToolbar({
  totalSelected,
  canMove = true,
  onMove,
  onDelete,
  onClear,
  isDeleting,
}: SelectionToolbarProps) {
  if (totalSelected === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-background p-4 shadow-lg">
      <InlineStack gap="4" blockAlign="center">
        <Text size="sm" weight="semibold">
          {totalSelected} {pluralize(totalSelected, "item")} selected
        </Text>
        <InlineStack gap="2">
          {canMove && (
            <Button variant="outline" size="sm" onClick={onMove}>
              <Icon name="FolderInput" />
              Move
            </Button>
          )}
          <ConfirmationDialog
            trigger={
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Icon name="Trash2" />
                Delete
              </Button>
            }
            title={`Delete ${totalSelected} ${pluralize(totalSelected, "item")}?`}
            description="Are you sure? Pipelines runs will not be impacted. Deleted folders will have their contents moved to root. This action cannot be undone."
            onConfirm={onDelete}
          />
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Icon name="X" />
          </Button>
        </InlineStack>
      </InlineStack>
    </div>
  );
}
