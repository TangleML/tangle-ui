import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { useFavorites } from "@/hooks/useFavorites";
import { removeRecentlyViewed } from "@/hooks/useRecentlyViewed";
import useToastNotification from "@/hooks/useToastNotification";
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";
import {
  deleteRemotePipeline,
  type RemotePipeline,
} from "@/services/remotePipelinesService";

interface RemotePipelineActionsProps {
  backendUrl: string;
  pipeline: RemotePipeline;
  onDeleted?: () => void;
}

export function RemotePipelineActions({
  backendUrl,
  pipeline,
  onDeleted,
}: RemotePipelineActionsProps) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();
  const { removeFavorite } = useFavorites();
  const name = pipeline.pipeline_name ?? "Untitled Pipeline";
  const { data: writerId, error: permissionError } = useQuery({
    queryKey: ["remote-pipeline-writer", backendUrl],
    queryFn: () => getRemotePipelineWriter(backendUrl),
    retry: false,
  });
  const deletion = useMutation({
    mutationKey: ["delete-remote-pipeline", backendUrl, pipeline.id],
    mutationFn: ({ backendUrl, pipeline }: RemotePipelineActionsProps) =>
      deleteRemotePipeline(backendUrl, pipeline),
    onSuccess: async (_, { backendUrl, pipeline, onDeleted }) => {
      try {
        removeRecentlyViewed("remote-pipeline", pipeline.id);
        await removeFavorite("remote-pipeline", pipeline.id);
      } catch {
        notify(
          "Pipeline deleted, but its local favorites or history could not be updated.",
          "warning",
        );
      }
      await queryClient.invalidateQueries({
        queryKey: RemotePipelineQueryKeys.All(backendUrl),
      });
      onDeleted?.();
    },
    onError: (error) => notify(error.message, "error"),
  });

  return (
    <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <FavoriteToggle
          type="remote-pipeline"
          id={pipeline.id}
          name={name}
          disabled={deletion.isPending}
        />
        {!permissionError && writerId === pipeline.user_id && (
          <ConfirmationDialog
            title={`Delete pipeline "${name}"?`}
            description="This deletes the saved pipeline. Existing pipeline runs will not be impacted. This action cannot be undone."
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete pipeline"
                title="Delete pipeline"
                className="text-foreground hover:text-destructive-foreground"
                disabled={deletion.isPending}
              >
                <Icon name="Trash" />
              </Button>
            }
            onConfirm={() =>
              deletion.mutate({ backendUrl, pipeline, onDeleted })
            }
          />
        )}
      </InlineStack>
    </div>
  );
}
