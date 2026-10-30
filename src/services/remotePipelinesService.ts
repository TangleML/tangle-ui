import { client } from "@/api/client.gen";
import { searchPipelinesApiPipelinesSearchPost } from "@/api/remotePipelines/sdk.gen";
import type { PipelineSummaryResponse } from "@/api/remotePipelines/types.gen";
import { normalizePipelineId } from "@/services/pipelineId";
import { pipelineApiError } from "@/services/pipelineSpecService";
import { waitForPendingRemotePipelineDraftWrites } from "@/services/pipelineStorage/drivers/RemotePipelineDraftStorageDriver";
import { waitForPendingRemotePipelineWrites } from "@/services/pipelineStorage/drivers/RemotePipelineStorageDriver";
import {
  RemotePipelineDeletionUncertainError,
  RemotePipelineStillAvailableError,
  withRemotePipelineDeletion,
} from "@/services/pipelineStorage/remotePipelineDeletion";
import type { RemotePipelineRef } from "@/services/pipelineStorage/types";
import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";
import type { FilterQueryPredicate } from "@/utils/pipelineRunFilterUtils";

export type RemotePipeline = PipelineSummaryResponse;

export interface RemotePipelinesPage {
  pipelines: RemotePipeline[];
  nextPageToken: string | null;
}

export interface RemotePipelineFilters {
  name?: string;
  id?: string;
  user?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

export function remotePipelineFiltersToQuery(
  filters: RemotePipelineFilters,
): string | undefined {
  const predicates = (
    [
      filters.name && {
        value_contains: {
          key: "system/pipeline.name",
          value_substring: filters.name,
        },
      },
      filters.id && {
        value_equals: { key: "system/pipeline.id", value: filters.id },
      },
      filters.user && {
        value_equals: { key: "system/pipeline.user_id", value: filters.user },
      },
      (filters.createdAfter || filters.createdBefore) && {
        time_range: {
          key: "system/pipeline.date.created_at",
          start_time: filters.createdAfter || undefined,
          end_time: filters.createdBefore || undefined,
        },
      },
      (filters.updatedAfter || filters.updatedBefore) && {
        time_range: {
          key: "system/pipeline.date.updated_at",
          start_time: filters.updatedAfter || undefined,
          end_time: filters.updatedBefore || undefined,
        },
      },
    ] satisfies (FilterQueryPredicate | "" | undefined)[]
  ).filter(Boolean);

  return predicates.length ? JSON.stringify({ and: predicates }) : undefined;
}

export async function listRemotePipelines(
  backendUrl: string,
  pageToken?: string,
  filterQuery?: string,
): Promise<RemotePipelinesPage> {
  const result = await searchPipelinesApiPipelinesSearchPost({
    client,
    baseUrl: backendUrl,
    body: {
      page_size: 10,
      page_token: pageToken,
      ...(filterQuery !== undefined && { filter_query: filterQuery }),
    },
  }).catch(() => {
    throw pipelineApiError("Failed to load pipelines", 0);
  });

  if (!result.data) {
    throw pipelineApiError(
      "Failed to load pipelines",
      result.response?.status ?? 0,
      result.error,
    );
  }

  return {
    pipelines: result.data.pipelines,
    nextPageToken: result.data.next_page_token ?? null,
  };
}

export async function getRemotePipelineName(
  backendUrl: string,
  pipelineId: string,
): Promise<string | null> {
  const { pipelines } = await listRemotePipelines(
    backendUrl,
    undefined,
    remotePipelineFiltersToQuery({ id: pipelineId }),
  );
  const id = normalizePipelineId(pipelineId);
  const match = pipelines.find(
    (pipeline) => normalizePipelineId(pipeline.id) === id,
  );
  return match?.pipeline_name ?? null;
}

export async function deleteRemotePipeline(
  backendUrl: string,
  pipeline: RemotePipeline,
): Promise<void> {
  const ref = {
    source: "remote",
    backendUrl,
    pipelineId: pipeline.id,
  } satisfies RemotePipelineRef;
  return withRemotePipelineDeletion(ref, pipeline.file_path, async () => {
    await Promise.all([
      waitForPendingRemotePipelineWrites(ref, pipeline.file_path),
      waitForPendingRemotePipelineDraftWrites(backendUrl, pipeline.file_path),
    ]);
    if ((await getRemotePipelineWriter(backendUrl)) !== pipeline.user_id) {
      throw new Error("You can only delete pipelines that you own.");
    }
    const result = await client
      .delete({
        baseUrl: backendUrl,
        url: "/api/pipelines/{pipeline_id}",
        path: { pipeline_id: normalizePipelineId(pipeline.id) },
      })
      .catch((error) => {
        throw new RemotePipelineDeletionUncertainError(error);
      });
    if (result.response.status === 404) {
      const current = await listRemotePipelines(
        backendUrl,
        undefined,
        remotePipelineFiltersToQuery({ id: pipeline.id }),
      ).catch((error) => {
        throw new RemotePipelineDeletionUncertainError(error);
      });
      if (!current.pipelines.length && !current.nextPageToken) return;
      if (
        current.pipelines.some(
          (candidate) =>
            candidate.id === pipeline.id &&
            candidate.file_path === pipeline.file_path,
        )
      )
        throw new RemotePipelineStillAvailableError();
      throw new RemotePipelineDeletionUncertainError();
    }
    if (result.response.status >= 500) {
      throw new RemotePipelineDeletionUncertainError(
        new Error(`Failed to delete pipeline (${result.response.status})`),
      );
    }
    if (!result.response.ok) {
      throw new Error(`Failed to delete pipeline (${result.response.status})`);
    }
  });
}
