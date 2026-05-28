import type { QueryClient } from "@tanstack/react-query";

import { TOUR_PIPELINE_PREFIX } from "@/providers/TourProvider/tourPipelineLifecycle";
import { EDITOR_SPEC_QUERY_KEY } from "@/routes/v2/pages/Editor/hooks/useLoadSpec";

import { SESSION_KEY_PREFIX } from "./constants";

export function resetAllTourPipelineState(queryClient: QueryClient): void {
  const sessionKeys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(SESSION_KEY_PREFIX)) {
      sessionKeys.push(key);
    }
  }
  for (const key of sessionKeys) {
    sessionStorage.removeItem(key);
  }

  queryClient.removeQueries({
    predicate: (query) => {
      const [head, second] = query.queryKey;
      return (
        head === EDITOR_SPEC_QUERY_KEY &&
        typeof second === "string" &&
        second.startsWith(TOUR_PIPELINE_PREFIX)
      );
    },
  });
}
