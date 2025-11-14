import { useMutation } from "@tanstack/react-query";
import { CircleSlash, CircleX } from "lucide-react";
import { useCallback, useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { cancelPipelineRun } from "@/services/pipelineRunService";

interface CancelPipelineRunButtonProps {
  runId: string | null | undefined;
}

export const CancelPipelineRunButton = ({
  runId,
}: CancelPipelineRunButtonProps) => {
  const { backendUrl, available } = useBackend();
  const notify = useToastNotification();

  const [isOpen, setIsOpen] = useState(false);

  const {
    mutate: cancelPipeline,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: (runId: string) => cancelPipelineRun(runId, backendUrl),
    onSuccess: () => {
      notify(`Pipeline run ${runId} cancelled`, "success");
    },
    onError: (error) => {
      notify(`Error cancelling run: ${error}`, "error");
    },
  });

  const handleConfirm = useCallback(() => {
    setIsOpen(false);

    if (!runId) {
      notify(`Failed to cancel run. No run ID found.`, "warning");
      return;
    }

    if (!available) {
      notify(`Backend is not available. Cannot cancel run.`, "warning");
      return;
    }

    try {
      cancelPipeline(runId);
    } catch (error) {
      notify(`Error cancelling run: ${error}`, "error");
    }
  }, [runId, available, notify, cancelPipeline]);

  const onClick = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (isSuccess) {
    return (
      <TooltipButton disabled tooltip="Run cancelled">
        <CircleSlash className="w-4 h-4" />
      </TooltipButton>
    );
  }

  return (
    <>
      <TooltipButton
        variant="destructive"
        onClick={onClick}
        tooltip="Cancel run"
        disabled={isPending || !available}
        data-testid="cancel-pipeline-run-button"
      >
        {isPending ? (
          <Spinner className="mr-2" />
        ) : (
          <div className="flex items-center gap-2">
            <CircleX className="w-4 h-4" />
          </div>
        )}
      </TooltipButton>

      <ConfirmationDialog
        isOpen={isOpen}
        title="Cancel run"
        description="The run will be scheduled for cancellation. This action cannot be undone."
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
