const pendingLocks = new Map<string, Promise<unknown>>();

export async function withPipelineLock<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return await navigator.locks.request(`pipeline-storage:${key}`, work);
  }

  const previous = pendingLocks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  pendingLocks.set(key, next);
  void next
    .finally(() => {
      if (pendingLocks.get(key) === next) pendingLocks.delete(key);
    })
    .catch(() => undefined);
  return next;
}
