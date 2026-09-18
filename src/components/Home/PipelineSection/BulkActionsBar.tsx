import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { FloatingSelectionBar } from "@/components/shared/FloatingSelectionBar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { deletePipeline } from "@/services/pipelineService";
import { getErrorMessage, pluralize } from "@/utils/string";

interface BulkActionsBarProps {
  selectedPipelines: string[];
  onDeleteSuccess: () => void;
  onClearSelection: () => void;
  onDeletePipeline?: (id: string) => Promise<void>;
  onDeleteSettled?: () => void;
}

const BulkActionsBar = ({
  selectedPipelines,
  onDeleteSuccess,
  onClearSelection,
  onDeletePipeline = deletePipeline,
  onDeleteSettled,
}: BulkActionsBarProps) => {
  const notify = useToastNotification();

  const handleBulkDelete = async () => {
    try {
      const results = await Promise.allSettled(
        selectedPipelines.map((id) => onDeletePipeline(id)),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      onDeleteSuccess();
      notify(
        `${selectedPipelines.length} pipelines successfully deleted`,
        "success",
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      notify("Failed to delete some pipelines: " + errorMessage, "error");
    } finally {
      onDeleteSettled?.();
    }
  };

  return (
    <FloatingSelectionBar
      count={selectedPipelines.length}
      itemNoun="pipeline"
      onClear={onClearSelection}
    >
      <ConfirmationDialog
        trigger={
          <Button variant="destructive" size="sm">
            <Icon name="Trash2" />
            Delete {selectedPipelines.length}{" "}
            {pluralize(selectedPipelines.length, "item")}
          </Button>
        }
        title={`Delete ${selectedPipelines.length} ${pluralize(selectedPipelines.length, "pipeline")}?`}
        description={`Are you sure you want to delete ${selectedPipelines.length === 1 ? "this pipeline" : "these pipelines"}? Existing pipeline runs will not be impacted. This action cannot be undone.`}
        onConfirm={handleBulkDelete}
      />
    </FloatingSelectionBar>
  );
};

export default BulkActionsBar;
