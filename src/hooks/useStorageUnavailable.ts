import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { useBackend } from "@/providers/BackendProvider";
import {
  isStorageAnswering,
  reportStorageAnswered,
  reportStorageFailed,
  subscribeStorageHealth,
} from "@/services/pipelineStorage/storageHealth";
import { isBackendStorage } from "@/services/pipelineStorage/storageMode";

const PING_STALE_MS = 10_000;

const PING_INTERVAL_MS = 30_000;

/**
 * Whether the backend holding the pipelines has gone away.
 *
 * Two sources, because either alone leaves a hole. What the app already asked
 * for is the cheapest and most direct answer, but a page nobody is touching
 * asks for nothing — an editor left open through a restart would show a healthy
 * store until the next keystroke. So the backend is also pinged on mount, on
 * return to the tab, and on a slow interval, and both report to the same place.
 */
export function useStorageUnavailable(): boolean {
  const backendStorage = isBackendStorage();
  const { ping, backendUrl } = useBackend();

  const answering = useSyncExternalStore(
    subscribeStorageHealth,
    isStorageAnswering,
    () => true,
  );

  useQuery({
    queryKey: ["pipeline-storage-reachable", backendUrl],
    queryFn: async () => {
      const reachable = await ping({ notifyResult: false });
      if (reachable) reportStorageAnswered();
      else reportStorageFailed("unavailable");
      return reachable;
    },
    enabled: backendStorage,
    staleTime: PING_STALE_MS,
    refetchInterval: PING_INTERVAL_MS,
    retry: false,
  });

  return backendStorage && !answering;
}
