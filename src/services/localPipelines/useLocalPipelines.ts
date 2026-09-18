import { useQuery } from "@tanstack/react-query";

import { MINUTES } from "@/utils/constants";

import {
  listLocalPipelineNames,
  readLocalPipeline,
  resolvePointers,
} from "./localPipelinesService";
import type { LocalPipelinePointer } from "./types";
import { LocalPipelinesQueryKeys, pointerKey } from "./types";

/**
 * Browser storage has no change signal covering renames and deletions, and the
 * one write event it does have is counted elsewhere to decide whether someone
 * has created their first pipeline — so firing it from here would credit them
 * wrongly. These queries go stale instead: coming back to the tab is exactly
 * when a pipeline renamed elsewhere needs picking up.
 */
const LOCAL_STALE_TIME = 1 * MINUTES;

export function useLocalPipelineNames() {
  return useQuery({
    queryKey: LocalPipelinesQueryKeys.Names(),
    queryFn: listLocalPipelineNames,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useLocalPipeline(pointer: LocalPipelinePointer | undefined) {
  return useQuery({
    queryKey: LocalPipelinesQueryKeys.Pointer(pointer ?? { localName: "" }),
    queryFn: () => {
      if (!pointer) {
        throw new Error("A pointer is required");
      }
      return readLocalPipeline(pointer).then((found) => found ?? null);
    },
    enabled: pointer !== undefined,
    staleTime: LOCAL_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}

export function useResolvedPointers(pointers: readonly LocalPipelinePointer[]) {
  const keys = pointers.map(pointerKey).sort();

  return useQuery({
    queryKey: [...LocalPipelinesQueryKeys.All(), "resolved", keys.join(",")],
    queryFn: () => resolvePointers(pointers),
    enabled: pointers.length > 0,
    staleTime: LOCAL_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}
