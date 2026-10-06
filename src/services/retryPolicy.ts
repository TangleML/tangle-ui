export const MAX_QUERY_RETRIES = 3;

/**
 * Whether a status is the backend's settled answer, which retrying can only
 * delay: without this, a deleted project's url sits on a spinner for the
 * length of three backoffs before it can say the project is gone.
 *
 * A timeout and a rate limit are the exceptions. Both are 4xx by status, but
 * both say "not yet" rather than "no", and a retry is the thing they ask for.
 */
export function isSettledRefusal(status: number): boolean {
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}
