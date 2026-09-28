import { MINUTES } from "@/utils/constants";

import { isSettledRefusal, MAX_QUERY_RETRIES } from "../retryPolicy";
import { ApiError } from "./errors";

function retryUnlessRefused(failureCount: number, error: Error) {
  if (error instanceof ApiError && isSettledRefusal(error.status)) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * Shared by every read in this service so the retry policy cannot go missing
 * from one of them — which is how a refused read used to cost three backoffs
 * anywhere but `useProjects`.
 */
export const projectQueryDefaults = {
  retry: retryUnlessRefused,
  staleTime: 5 * MINUTES,
  refetchOnWindowFocus: false,
} as const;
