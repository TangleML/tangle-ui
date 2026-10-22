import { useQuery } from "@tanstack/react-query";

import { listRemotePipelines } from "@/services/remotePipelinesService";

export function useRemotePipelinesPage(
  backendUrl: string,
  pageToken: string | undefined,
  enabled: boolean,
  filterQuery?: string,
) {
  return useQuery({
    queryKey: ["remote-pipelines", backendUrl, filterQuery, pageToken],
    queryFn: () => listRemotePipelines(backendUrl, pageToken, filterQuery),
    enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === backendUrl ? previous : undefined,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
