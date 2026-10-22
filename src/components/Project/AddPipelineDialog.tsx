import { useEffect, useState } from "react";

import { PaginationControls } from "@/components/shared/PaginationControls";
import { useDebouncedSearchValue } from "@/hooks/useDebouncedSearchValue";
import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { remotePipelineResourceInput } from "@/services/projects/pipelineResource";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";
import { remotePipelineFiltersToQuery } from "@/services/remotePipelinesService";

import { PickFromListDialog } from "./PickFromListDialog";

interface AddPipelineDialogProps {
  projectId: string;
  resources: ProjectResourceSummary[];
  onOpenChange: (open: boolean) => void;
}

export function AddPipelineDialog({
  projectId,
  resources,
  onOpenChange,
}: AddPipelineDialogProps) {
  const { backendUrl, configured, available } = useBackend();
  const [filter, setFilter] = useState("");
  const [pagination, setPagination] = useState({
    backendUrl,
    filter,
    tokens: [] as string[],
  });
  const tokens =
    pagination.backendUrl === backendUrl && pagination.filter === filter
      ? pagination.tokens
      : [];
  const [query, setQuery] = useDebouncedSearchValue(setFilter);
  const { data, isPending, isFetching, isPlaceholderData, error } =
    useRemotePipelinesPage(
      backendUrl,
      tokens.at(-1),
      configured && available,
      remotePipelineFiltersToQuery({ name: filter.trim() }),
    );
  const { mutate: createResource, isPending: isCreating } =
    useCreateProjectResource(projectId);
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const alreadyAdded = new Set(
    resources
      .filter((resource) => resource.entity === "pipeline")
      .map((resource) => resource.entityId),
  );

  useEffect(() => {
    track("projects.add_pipeline_dialog_impression");
  }, [track]);

  const backendError = !configured
    ? new Error("Configure a backend to view pipelines.")
    : !available
      ? new Error("Pipelines are unavailable.")
      : null;
  const items = backendError
    ? undefined
    : data?.pipelines.map((pipeline) => ({
        id: pipeline.id,
        label: pipeline.pipeline_name ?? pipeline.id,
        alreadyAdded: alreadyAdded.has(pipeline.id),
      }));

  const add = (pipelineId: string) => {
    const item = items?.find((pipeline) => pipeline.id === pipelineId);
    if (!item || isPlaceholderData) return;
    createResource(remotePipelineResourceInput(pipelineId, item.label), {
      onSuccess: () => {
        track("projects.add_pipeline_completed");
        notify("Pipeline added", "success");
        onOpenChange(false);
      },
    });
  };

  return (
    <PickFromListDialog
      title="Add a pipeline"
      helpText="Choose a saved pipeline to add to this project."
      noun="pipeline"
      icon="GitBranch"
      items={items}
      error={backendError ?? error}
      isPending={!backendError && isPending}
      isAdding={isCreating || isPlaceholderData}
      emptyTitle="No pipelines found"
      emptyDescription="Save a pipeline in the editor and it will show up here."
      selectTracking="projects.add_pipeline_select"
      cancelTracking="projects.add_pipeline_cancel"
      onPick={add}
      onClose={() => onOpenChange(false)}
      search={{ value: query, onChange: setQuery }}
      pagination={
        <PaginationControls
          currentPage={tokens.length + 1}
          hasNextPage={Boolean(data?.nextPageToken)}
          hasPreviousPage={tokens.length > 0}
          disabled={isFetching || isCreating}
          onNextPage={() => {
            if (data?.nextPageToken)
              setPagination({
                backendUrl,
                filter,
                tokens: [...tokens, data.nextPageToken],
              });
          }}
          onPreviousPage={() =>
            setPagination({ backendUrl, filter, tokens: tokens.slice(0, -1) })
          }
          onReset={() => setPagination({ backendUrl, filter, tokens: [] })}
        />
      }
    />
  );
}
