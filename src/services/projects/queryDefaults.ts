import { MINUTES } from "@/utils/constants";

import { ApiError } from "./errors";

const MAX_RETRIES = 3;

/**
 * A 4xx is the backend's settled answer, so retrying only delays it: without
 * this, a deleted project's url sits on a spinner for the length of three
 * backoffs before it can say the project is gone.
 */
function retryUnlessRefused(failureCount: number, error: Error) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
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
