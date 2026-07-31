import { useQuery } from "@tanstack/react-query";

import type { ListPipelineJobsResponse } from "@/api/types.gen";
import { useBackend } from "@/providers/BackendProvider";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

const PIPELINE_RUNS_QUERY_URL = "/api/pipeline_runs/";

interface UseCompareRunListParams {
  filterQuery?: string;
  pageToken?: string;
}

export function useCompareRunList({
  filterQuery,
  pageToken,
}: UseCompareRunListParams = {}) {
  const { backendUrl, configured, available } = useBackend();

  return useQuery<ListPipelineJobsResponse>({
    queryKey: ["compare-run-picker", backendUrl, filterQuery, pageToken],
    refetchOnWindowFocus: false,
    enabled: configured && available,
    queryFn: async () => {
      const url = new URL(PIPELINE_RUNS_QUERY_URL, backendUrl);
      if (filterQuery) url.searchParams.set("filter_query", filterQuery);
      if (pageToken) url.searchParams.set("page_token", pageToken);
      url.searchParams.set("include_pipeline_names", "true");
      url.searchParams.set("include_execution_stats", "true");
      return fetchWithErrorHandling(url.toString());
    },
  });
}
