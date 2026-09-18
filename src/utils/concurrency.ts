/**
 * Works through `items` with at most `limit` in flight. A store that answers
 * one pipeline per request should not be sent the whole list at once, and
 * `Promise.all` over a `map` would do exactly that.
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];

  const drain = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await worker(item);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, drain),
  );
}
