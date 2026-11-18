import { MINUTES } from "@/utils/constants";

import { isSettledRefusal, MAX_QUERY_RETRIES } from "../retryPolicy";
import { ApiError } from "./errors";

/**
 * The most the API will return in one page. Its own default is 20. A lookup
 * that searches a whole list from a single page asks for the maximum so that
 * it misses as little as it can, and one that follows `nextPageToken` asks for
 * it to make fewer requests.
 */
export const MAX_PAGE_SIZE = 100;

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
