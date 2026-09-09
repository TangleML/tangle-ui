import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import { resetBackendPipelines } from "@/services/pipelineStorage/devReset";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getErrorMessage, pluralize } from "@/utils/string";

/**
 * Trying the first-use copy more than once means emptying the backend first,
 * which no user ever needs to do. It leaves the pipeline list, because the copy
 * starts from there and would begin again the moment it finished.
 */
export function ResetBackendPipelinesButton() {
  const storage = usePipelineStorage();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const [isResetting, setIsResetting] = useState(false);

  if (!import.meta.env.DEV || storage.mode.kind !== "backend") return null;

  const handleReset = async () => {
    setIsResetting(true);

    try {
      const removed = await resetBackendPipelines(storage.rootFolder);
      notify(
        `Removed ${removed} ${pluralize(removed, "pipeline")}. Reload to copy this browser's pipelines up again.`,
        "success",
      );
      await navigate({ to: APP_ROUTES.DASHBOARD });
    } catch (error) {
      notify(`Could not empty the backend: ${getErrorMessage(error)}`, "error");
      setIsResetting(false);
    }
  };

  return (
    <ConfirmationDialog
      trigger={
        <Button variant="destructive" size="sm" disabled={isResetting}>
          <Icon name="Eraser" />
          Reset backend pipelines
        </Button>
      }
      title="Delete every pipeline in the backend?"
      description="This empties the backend so it looks like you have never used one, and returns you to the dashboard. Pipelines in this browser are left alone, and are copied up again on the next load. Development only."
      onConfirm={() => void handleReset()}
    />
  );
}
