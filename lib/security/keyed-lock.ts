/**
 * Serializes async work per key within this process (e.g. "one analysis start
 * per CV at a time"), so concurrent duplicate requests see each other's writes.
 * Per-instance only: multiple servers need a distributed lock (e.g. Redis).
 */
export function createKeyedLock() {
  const tails = new Map<string, Promise<unknown>>();

  return async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(fn);
    tails.set(key, next);
    try {
      return await next;
    } finally {
      if (tails.get(key) === next) tails.delete(key);
    }
  };
}
