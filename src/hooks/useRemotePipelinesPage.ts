import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listRemotePipelines,
  type RemotePipelinesPage,
} from "@/services/remotePipelinesService";

interface NumberedRemotePipelinesPage extends RemotePipelinesPage {
  page: number;
}

export function useRemotePipelinesPage(
  backendUrl: string,
  page: number,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["remote-pipelines-page", backendUrl, page],
    queryFn: async (): Promise<NumberedRemotePipelinesPage> => {
      let pageToken: string | undefined;
      for (let previousPage = 1; previousPage < page; previousPage++) {
        const token = pageToken;
        const previousPageQuery = {
          queryKey: ["remote-pipelines", backendUrl, token],
          queryFn: () => listRemotePipelines(backendUrl, token),
          retry: false,
          staleTime: 0,
        };
        const cached = queryClient.getQueryData(previousPageQuery.queryKey);
        let previous = await queryClient.ensureQueryData(previousPageQuery);
        if (cached && !previous.nextPageToken) {
          previous = await queryClient.fetchQuery(previousPageQuery);
        }
        if (!previous.nextPageToken) return { ...previous, page: previousPage };
        pageToken = previous.nextPageToken;
      }
      return {
        ...(await queryClient.fetchQuery({
          queryKey: ["remote-pipelines", backendUrl, pageToken],
          queryFn: () => listRemotePipelines(backendUrl, pageToken),
          staleTime: 0,
          retry: false,
        })),
        page,
      };
    },
    enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === backendUrl ? previous : undefined,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const totalCount =
    query.data?.totalCount ??
    queryClient.getQueryData<RemotePipelinesPage>([
      "remote-pipelines",
      backendUrl,
      undefined,
    ])?.totalCount ??
    0;

  return { ...query, totalCount };
}
