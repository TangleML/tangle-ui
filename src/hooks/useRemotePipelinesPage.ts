import { useQuery } from "@tanstack/react-query";

import { listRemotePipelines } from "@/services/remotePipelinesService";

export function useRemotePipelinesPage(
  backendUrl: string,
  pageToken: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["remote-pipelines", backendUrl, pageToken],
    queryFn: () => listRemotePipelines(backendUrl, pageToken),
    enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === backendUrl ? previous : undefined,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
