import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { reanalyzeAllPipelines } from "@/routes/tangent/services/tangentApi";
import { TangentQueryKeys } from "@/routes/tangent/types";

export function useReanalyzeAll() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: reanalyzeAllPipelines,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: TangentQueryKeys.Pipelines(),
      });
      notify(
        "Re-analysis queued for all pipelines. Scores will update in ~5–10 min as the Tangent Researcher runs.",
        "success",
      );
    },
    onError: () => {
      notify("Failed to queue re-analysis", "error");
    },
  });
}
