import { useQuery } from "@tanstack/react-query";

import { getCollabServerUrl } from "@/services/collaboration/collabServerUrl";

import { fetchCollabServerInfo } from "./collabServerApi";

const SERVER_INFO_STALE_TIME_MS = 60_000;

export function useCollabServerInfo() {
  return useQuery({
    queryKey: ["collab-server-info", getCollabServerUrl()],
    queryFn: fetchCollabServerInfo,
    staleTime: SERVER_INFO_STALE_TIME_MS,
    retry: false,
  });
}
