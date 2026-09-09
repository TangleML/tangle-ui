import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { isHostStorage } from "@/services/pipelineStorage/storageMode";

const PING_STALE_MS = 10_000;

const PING_INTERVAL_MS = 30_000;

/**
 * Whether the deployment holding the pipelines is answering. Asked directly
 * rather than inferred from a failed listing: a listing that is slow, still
 * retrying, or served from cache leaves a stale library on screen saying
 * nothing, which is the one thing this must never do.
 *
 * The provider's flag alone is not enough — it is pinged when the app starts
 * and not again — so this re-asks on mount, on return to the tab, and while the
 * page is open, which is where a deployment usually goes down.
 */
export function useStorageBackendUnavailable(): boolean {
  const { ping, backendUrl } = useBackend();
  const hostStorage = isHostStorage();

  const { data: reachable } = useQuery({
    queryKey: ["pipeline-storage-backend", backendUrl],
    queryFn: () => ping({ notifyResult: false }),
    enabled: hostStorage,
    staleTime: PING_STALE_MS,
    refetchInterval: PING_INTERVAL_MS,
    retry: false,
  });

  return hostStorage && reachable === false;
}
