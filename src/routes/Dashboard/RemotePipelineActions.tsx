import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";

import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { FavoriteToggle } from "@/components/shared/FavoriteToggle";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { useFavorites } from "@/hooks/useFavorites";
import { removeRecentlyViewed } from "@/hooks/useRecentlyViewed";
import useToastNotification from "@/hooks/useToastNotification";
import { reconcileDeletedRemotePipeline } from "@/routes/v2/pages/Editor/hooks/deletedRemotePipelineCache";
import { RemotePipelineDeletionUncertainError } from "@/services/pipelineStorage/remotePipelineDeletion";
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";
import {
  deleteRemotePipeline,
  type RemotePipeline,
} from "@/services/remotePipelinesService";

interface RemotePipelineActionsProps {
  backendUrl: string;
  pipeline: RemotePipeline;
  onDeleted?: (restoreFocus: boolean) => void;
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mutationKey = RemotePipelineQueryKeys.Deletion(backendUrl, pipeline.id);
  const isDeleting = useIsMutating({ mutationKey, exact: true }) > 0;
  const { data: writerId, error: permissionError } = useQuery({
    queryKey: ["remote-pipeline-writer", backendUrl],
    queryFn: () => getRemotePipelineWriter(backendUrl),
    retry: false,
  });
  const deletion = useMutation({
    mutationKey,
    mutationFn: ({ backendUrl, pipeline }: RemotePipelineActionsProps) =>
      deleteRemotePipeline(backendUrl, pipeline),
    onSuccess: async (_, { backendUrl, pipeline, onDeleted }) => {
      const canRestoreFocus = () =>
        document.activeElement === triggerRef.current ||
        document.activeElement === document.body;
      const restoreFocus = canRestoreFocus();
      await reconcileDeletedRemotePipeline(queryClient, {
        source: "remote",
        backendUrl,
        pipelineId: pipeline.id,
      });
      const cleanup = await Promise.allSettled([
        Promise.resolve().then(() =>
          removeRecentlyViewed("remote-pipeline", pipeline.id, backendUrl),
        ),
        removeFavorite("remote-pipeline", pipeline.id, backendUrl),
      ]);
      if (cleanup.some((result) => result.status === "rejected")) {
        notify(
          "Pipeline deleted, but its local favorites or history could not be updated.",
          "warning",
        );
      }
      await queryClient.invalidateQueries({
        queryKey: RemotePipelineQueryKeys.All(backendUrl),
      });
      onDeleted?.(restoreFocus && canRestoreFocus());
    },
    onError: async (error, { backendUrl, pipeline, onDeleted }) => {
      if (error instanceof RemotePipelineDeletionUncertainError) {
        await reconcileDeletedRemotePipeline(
          queryClient,
          { source: "remote", backendUrl, pipelineId: pipeline.id },
          error,
        );
        await queryClient.invalidateQueries({
          queryKey: RemotePipelineQueryKeys.All(backendUrl),
        });
        onDeleted?.(false);
        notify(
          "Could not confirm whether the pipeline was deleted. Refresh the list or delete again to confirm.",
          "error",
        );
        return;
      }
      notify(error.message, "error");
    },
  });

  return (
    <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <FavoriteToggle
          type="remote-pipeline"
          id={pipeline.id}
          name={name}
          disabled={isDeleting}
        />
        {!permissionError && writerId === pipeline.user_id && (
          <ConfirmationDialog
            title={`Delete pipeline "${name}"?`}
            description="This deletes the saved pipeline. Existing pipeline runs will not be impacted. This action cannot be undone."
            trigger={
              <Button
                ref={triggerRef}
                variant="ghost"
                size="icon"
                aria-label={`Delete ${name}`}
                title={`Delete ${name}`}
                className="text-foreground hover:text-destructive-foreground aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                aria-disabled={isDeleting}
                onClick={(event) => {
                  if (queryClient.isMutating({ mutationKey, exact: true }))
                    event.preventDefault();
                }}
              >
                <Icon name="Trash" />
              </Button>
            }
            onConfirm={() => {
              if (queryClient.isMutating({ mutationKey, exact: true })) return;
              deletion.mutate({ backendUrl, pipeline, onDeleted });
            }}
            onCloseAutoFocus={(event) => {
              // Keep focus recovered by the table or moved by the user.
              if (
                !triggerRef.current?.isConnected ||
                (document.activeElement !== document.body &&
                  document.activeElement !== triggerRef.current)
              )
                event.preventDefault();
            }}
          />
        )}
      </InlineStack>
    </div>
  );
}
