import { createHash } from "node:crypto";
import { fingerprint, logSecurityEvent } from "./audit-log";

/**
 * Fixed-window rate limiting behind a pluggable store.
 *
 * Every limiter has a unique `name`, so keys from different limiters never
 * collide in a shared store. Checks are async so the store can be remote.
 *
 * The default store is in-memory: limits apply per server instance and reset on
 * restart. For more than one instance, install a shared store at startup with
 * `setRateLimitStore()` (e.g. a Redis adapter implementing `hit` with
 * INCR + PEXPIRE NX in one MULTI). No external store is required or configured.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export type RateLimitWindow = { count: number; resetAt: number };

export interface RateLimitStore {
  /**
   * Atomically counts one hit for `key` in its current fixed window (starting a
   * new window of `windowMs` if none is active) and returns the window state.
   */
  hit(key: string, windowMs: number, now: number): Promise<RateLimitWindow>;
}

/** Bounded in-memory store (single instance only). */
export function createMemoryRateLimitStore({ maxKeys = 50_000 } = {}): RateLimitStore {
  const windows = new Map<string, RateLimitWindow>();
  return {
    async hit(key, windowMs, now) {
      if (windows.size >= maxKeys) {
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
        // Still full of live windows (e.g. a flood of distinct keys): drop the oldest.
        if (windows.size >= maxKeys) windows.delete(windows.keys().next().value!);
      }
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs };
        windows.set(key, fresh);
        return { ...fresh };
      }
      current.count += 1;
      return { ...current };
    },
  };
}

let store: RateLimitStore = createMemoryRateLimitStore();

/** Installs a shared store (call once at startup, before any request). */
export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

/** Long or unusual keys (emails, IPs) are hashed so stored keys stay short and opaque. */
function storeKey(name: string, key: string) {
  const safe = /^[\w.:@-]{1,120}$/.test(key)
    ? key
    : createHash("sha256").update(key).digest("base64url");
  return `rl:${name}:${safe}`;
}

/** `name` must be unique across the app (enforced by a unit test). */
export function createRateLimiter({
  name,
  limit,
  windowMs,
}: {
  name: string;
  limit: number;
  windowMs: number;
}) {
  return async function check(key: string, now: number = Date.now()): Promise<RateLimitResult> {
    const window = await store.hit(storeKey(name, key), windowMs, now);
    if (window.count <= limit) return { ok: true };
    // Once per window, not per blocked request, so an attack can't flood the log.
    if (window.count === limit + 1)
      logSecurityEvent("rate_limit.exceeded", { limiter: name, key: fingerprint(key) });
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)) };
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
