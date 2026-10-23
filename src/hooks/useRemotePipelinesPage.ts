import { useQuery } from "@tanstack/react-query";

import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";
import { listRemotePipelines } from "@/services/remotePipelinesService";

export function useRemotePipelinesPage(
  backendUrl: string,
  pageToken: string | undefined,
  enabled: boolean,
  filterQuery?: string,
) {
  return useQuery({
    queryKey: RemotePipelineQueryKeys.Cursor(
      backendUrl,
      filterQuery,
      pageToken,
    ),
    queryFn: () => listRemotePipelines(backendUrl, pageToken, filterQuery),
    enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === backendUrl ? previous : undefined,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
