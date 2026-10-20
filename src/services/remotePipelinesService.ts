import { client } from "@/api/client.gen";
import { searchPipelinesApiPipelinesSearchPost } from "@/api/remotePipelines/sdk.gen";
import type { PipelineSummaryResponse } from "@/api/remotePipelines/types.gen";
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
  });

  if (!result.data) {
    throw new Error(`Failed to load pipelines (${result.response.status})`);
  }

  return {
    pipelines: result.data.pipelines,
    nextPageToken: result.data.next_page_token ?? null,
  };
}
