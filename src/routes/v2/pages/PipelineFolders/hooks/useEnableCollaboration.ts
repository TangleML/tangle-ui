import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { enableCollaboration } from "./enableCollaborationApi";

export function useEnableCollaboration() {
  const navigate = useNavigate();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (file: PipelineFile) => enableCollaboration(file),
    onSuccess: (roomId) => {
      navigate({ to: APP_ROUTES.EDITOR_V2_COLLAB, params: { roomId } });
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to enable collaboration",
        "error",
      );
    },
  });
}
