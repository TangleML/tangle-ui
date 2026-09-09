import { HostStorageError } from "./drivers/HostStorageDriver";
import {
  AmbiguousPipelineNameError,
  PipelineNotFoundError,
} from "./PipelineStorageService";

const NUM_RETRIES = 3;

/**
 * Trying again only helps when the answer might differ next time. A store that
 * has said what it holds — no such pipeline, more than one by that name, a
 * session that has expired — will say the same thing three more times, and the
 * delay before the user is told buys nothing.
 */
export function isRetriableStorageError(
  failureCount: number,
  error: Error,
): boolean {
  if (failureCount >= NUM_RETRIES) return false;

  if (
    error instanceof PipelineNotFoundError ||
    error instanceof AmbiguousPipelineNameError
  ) {
    return false;
  }

  if (error instanceof HostStorageError) {
    return error.code === "unavailable" || error.code === "rate_limited";
  }

  return true;
}
