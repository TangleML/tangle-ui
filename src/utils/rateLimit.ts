type QueuedRequest<T> = {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const DEFAULT_RATE_LIMIT = 5; // requests per second

/**
 * Token Bucket Rate Limiter for API calls.
 *
 * - Bucket holds up to `bucketSize` tokens (default: 1, no burst)
 * - Tokens refill continuously at `rate` per second
 * - Each request consumes 1 token
 * - Requests queue when no tokens available
 *
 * @param fn - The function to rate limit
 * @param rate - The rate limit in requests per second (default: 5)
 * @param bucketSize - Maximum burst size (default: 1 for strict rate limiting)
 * @returns A rate-limited function with dispose method
 */
export function rateLimit<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  {
    rate = DEFAULT_RATE_LIMIT,
    bucketSize = 1,
  }: {
    rate?: number;
    bucketSize?: number;
  } = {},
): {
  (...args: TArgs): Promise<TResult>;
  dispose: () => void;
} {
  if (rate <= 0 || !Number.isFinite(rate) || !Number.isInteger(rate)) {
    throw new Error("Rate must be a positive finite integer number");
  }
  if (
    bucketSize < 1 ||
    !Number.isFinite(bucketSize) ||
    !Number.isInteger(bucketSize)
  ) {
    throw new Error("Bucket size must be a positive finite integer number");
  }

  let tokens = bucketSize;
  let lastRefill = performance.now();
  const queue: QueuedRequest<TResult>[] = [];
  let isDisposed = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Refill tokens based on elapsed time since last refill.
   * Tokens accumulate continuously up to bucketSize.
   */
  const refillTokens = (): void => {
    const now = performance.now();
    const elapsed = Math.max(0, now - lastRefill); // Guard against edge cases
    const tokensToAdd = (elapsed / 1000) * rate;

    tokens = Math.min(bucketSize, tokens + tokensToAdd);
    lastRefill = now;
  };

  /**
   * Calculate wait time until at least 1 token is available.
   */
  const getWaitTime = (): number => {
    if (tokens >= 1) return 0;

    const tokensNeeded = 1 - tokens;
    const msPerToken = 1000 / rate;
    return Math.ceil(tokensNeeded * msPerToken);
  };

  /**
   * Process queued requests while tokens are available.
   */
  const processQueue = (): void => {
    if (isDisposed) return;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    refillTokens();

    // Process requests while we have tokens
    while (queue.length > 0 && tokens >= 1) {
      tokens -= 1;
      const req = queue.shift();

      if (req) {
        // Wrap in Promise.resolve to safely catch sync errors
        Promise.resolve()
          .then(() => req.fn())
          .then(req.resolve)
          .catch(req.reject)
          .finally(() => {
            // Re-check queue when request completes
            if (queue.length > 0 && !isDisposed && timeoutId === null) {
              scheduleProcessing();
            }
          });
      }
    }

    // Schedule next processing when tokens will be available
    if (queue.length > 0) {
      const waitTime = getWaitTime();
      scheduleProcessing(waitTime);
    }
  };

  /**
   * Schedule queue processing after a delay.
   * Clears any existing scheduled processing first.
   */
  const scheduleProcessing = (delay?: number): void => {
    if (isDisposed) return;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const waitTime = delay ?? getWaitTime();
    timeoutId = setTimeout(processQueue, Math.max(0, waitTime));
  };

  /**
   * Queue a rate-limited function call.
   */
  const call = (...args: TArgs): Promise<TResult> => {
    if (isDisposed) {
      return Promise.reject(new Error("Rate limiter has been disposed"));
    }

    return new Promise<TResult>((resolve, reject) => {
      queue.push({
        fn: () => fn(...args),
        resolve,
        reject,
      });

      // Use microtask to batch multiple synchronous calls
      queueMicrotask(processQueue);
    });
  };

  /**
   * Dispose the rate limiter, rejecting all pending requests.
   */
  const dispose = (): void => {
    isDisposed = true;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Reject all pending requests
    while (queue.length > 0) {
      const req = queue.shift();
      req?.reject(new Error("Rate limiter disposed"));
    }

    tokens = 0;
  };

  call.dispose = dispose;

  return call;
}
