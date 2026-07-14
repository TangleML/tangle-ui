import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { cancelPipelineRun } from "@/services/pipelineRunService";

export function useCancelPipelineRun(runId?: string | null) {
  const notify = useToastNotification();
  const { backendUrl, available } = useBackend();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { mutate: cancelRun, isPending: isCancelling } = useMutation({
    mutationFn: (runId: string) => cancelPipelineRun(runId, backendUrl),
    onSuccess: () => {
      notify("Pipeline run cancelled", "success");
    },
    onError: (error) => {
      notify(`Error cancelling run: ${error}`, "error");
    },
  });

  const requestCancel = () => {
    setCancelDialogOpen(true);
  };

  const dismissCancel = () => {
    setCancelDialogOpen(false);
  };

  const confirmCancel = () => {
    setCancelDialogOpen(false);

    if (!runId) {
      notify("Failed to cancel run. No run ID found.", "warning");
      return;
    }

    if (!available) {
      notify("Backend is not available. Cannot cancel run.", "warning");
      return;
    }

    cancelRun(runId);
  };

  return {
    cancelDialogOpen,
    isCancelling,
    requestCancel,
    confirmCancel,
    dismissCancel,
  };
}
