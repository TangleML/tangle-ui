import { BackendStorageError } from "./drivers/BackendStorageDriver";
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

  if (error instanceof BackendStorageError) {
    return error.code === "unavailable" || error.code === "rate_limited";
  }

  return true;
}

/**
 * A write the store will refuse again for the same reason. An expired session
 * needs the person, not another attempt, and quietly retrying one until it
 * comes back is how work sits unsaved with nobody told why.
 */
export function isWriteWorthRetrying(error: unknown): boolean {
  if (error instanceof BackendStorageError) {
    return error.code !== "unauthenticated" && error.code !== "conflict";
  }

  return true;
}

export function isExpiredSession(error: unknown): boolean {
  return (
    error instanceof BackendStorageError && error.code === "unauthenticated"
  );
}
