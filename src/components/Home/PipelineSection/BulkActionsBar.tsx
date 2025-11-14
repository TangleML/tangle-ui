import { useCallback } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { deletePipeline } from "@/services/pipelineService";
import { getErrorMessage, pluralize } from "@/utils/string";

interface BulkActionsBarProps {
  selectedPipelines: string[];
  onDeleteSuccess: () => void;
  onClearSelection: () => void;
}

const BulkActionsBar = ({
  selectedPipelines,
  onDeleteSuccess,
  onClearSelection,
}: BulkActionsBarProps) => {
  const notify = useToastNotification();

  const handleBulkDelete = useCallback(async () => {
    const deletePromises = selectedPipelines.map((pipelineName) =>
      deletePipeline(pipelineName),
    );

    try {
      await Promise.all(deletePromises);
      onDeleteSuccess();
      notify(
        `${selectedPipelines.length} pipelines successfully deleted`,
        "success",
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      notify("Failed to delete some pipelines: " + errorMessage, "error");
    }
  }, [selectedPipelines, onDeleteSuccess, notify]);

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-background border border-border rounded-lg shadow-lg p-4 z-50">
      <InlineStack gap="4" blockAlign="center">
        <span className="text-sm font-medium">
          {selectedPipelines.length}{" "}
          {pluralize(selectedPipelines.length, "pipeline")} selected
        </span>

        <InlineStack gap="2" blockAlign="center">
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

          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <Icon name="X" />
          </Button>
        </InlineStack>
      </InlineStack>
    </div>
  );
};

export default BulkActionsBar;
