/** 
 * High-performance typed fetch wrapper for RAQAMORA.
 * Features:
 * - Instant L1 in-memory caching (0ms response)
 * - Stale-While-Revalidate (SWR) background revalidation
 * - In-flight request deduplication (prevents redundant parallel HTTP requests)
 * - Offline resilience & automatic queue replay
 */
import {
  enqueueMutation,
  getCachedGet,
  setCachedGet,
  invalidateCache,
} from "@/lib/raqamora/offline-sync";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

// In-flight parallel request deduplication map
const inFlight = new Map<string, Promise<any>>();

export interface ApiGetOptions {
  force?: boolean;
  ttl?: number;
}

export async function apiGet<T>(path: string, options?: ApiGetOptions): Promise<T> {
  // 1. In-flight deduplication: If a request for this exact path is already executing, reuse its promise!
  if (inFlight.has(path) && !options?.force) {
    return inFlight.get(path) as Promise<T>;
  }

  // 2. Check L1 / L2 Cache
  const cached = getCachedGet<T>(path);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isOffline) {
    if (cached !== null) return cached;
    throw new ApiError(503, "Offline and no cached data available");
  }

  // Reference data like categories, accounts, people rarely change: use longer TTL (60s)
  const isReference =
    path.includes("/categories") || path.includes("/accounts") || path.includes("/people");
  const ttl = options?.ttl ?? (isReference ? 60_000 : 15_000);

  // 3. Stale-While-Revalidate: If we have cached data and not explicitly forcing, return cached data INSTANTLY (0ms)
  // and trigger a silent background revalidation if needed
  if (cached !== null && !options?.force) {
    // Launch non-blocking background revalidation
    const bgPromise = fetch(path, { credentials: "same-origin" })
      .then((res) => handle<T>(res))
      .then((fresh) => {
        setCachedGet(path, fresh);
        return fresh;
      })
      .catch(() => cached);

    inFlight.set(path, bgPromise);
    bgPromise.finally(() => inFlight.delete(path));

    return cached;
  }

  // 4. Cache miss: Fetch from server with deduplication
  const fetchPromise = (async () => {
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      const data = await handle<T>(res);
      setCachedGet(path, data);
      return data;
    } catch (err) {
      if (cached !== null) {
        return cached;
      }
      throw err;
    } finally {
      inFlight.delete(path);
    }
  })();

  inFlight.set(path, fetchPromise);
  return fetchPromise;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  payload?: unknown,
  title?: string,
): Promise<T> {
  // If explicitly offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const queued = enqueueMutation(path, method, payload, title);
    // Invalidate affected memory caches so next read picks up optimistic mutation
    invalidateCacheByPath(path);
    return { ok: true, offline: true, id: queued.id } as T;
  }

  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const result = await handle<T>(res);

    // Invalidate relevant caches on successful mutation
    invalidateCacheByPath(path);

    return result;
  } catch (err) {
    const isNetworkError =
      (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) ||
      (typeof navigator !== "undefined" && !navigator.onLine);

    if (isNetworkError) {
      const queued = enqueueMutation(path, method, payload, title);
      invalidateCacheByPath(path);
      return { ok: true, offline: true, id: queued.id } as T;
    }
    throw err;
  }
}

function invalidateCacheByPath(path: string) {
  if (path.includes("/transactions")) {
    invalidateCache("/api/transactions");
    invalidateCache("/api/dashboard");
    invalidateCache("/api/accounts");
    invalidateCache("/api/reports");
  } else if (path.includes("/accounts")) {
    invalidateCache("/api/accounts");
    invalidateCache("/api/dashboard");
  } else if (path.includes("/debts")) {
    invalidateCache("/api/debts");
    invalidateCache("/api/dashboard");
    invalidateCache("/api/people");
  } else if (path.includes("/budgets")) {
    invalidateCache("/api/budgets");
    invalidateCache("/api/dashboard");
  } else if (path.includes("/goals")) {
    invalidateCache("/api/goals");
    invalidateCache("/api/dashboard");
  } else if (path.includes("/people")) {
    invalidateCache("/api/people");
    invalidateCache("/api/debts");
  }
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
