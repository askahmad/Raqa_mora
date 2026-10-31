/** Tiny typed fetch wrapper for RAQAMORA API routes with offline resilience & auto-sync. */
import {
  enqueueMutation,
  getCachedGet,
  setCachedGet,
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

export async function apiGet<T>(path: string): Promise<T> {
  // If explicitly offline, check cache immediately without waiting for fetch error
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = getCachedGet<T>(path);
    if (cached !== null) {
      return cached;
    }
  }

  try {
    const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
    const data = await handle<T>(res);
    setCachedGet(path, data);
    return data;
  } catch (err) {
    // If offline or network request failed, return cached data if available
    const cached = getCachedGet<T>(path);
    if (cached !== null) {
      return cached;
    }
    throw err;
  }
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
    return { ok: true, offline: true, id: queued.id } as T;
  }

  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return await handle<T>(res);
  } catch (err) {
    const isNetworkError =
      (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) ||
      (typeof navigator !== "undefined" && !navigator.onLine);

    if (isNetworkError) {
      const queued = enqueueMutation(path, method, payload, title);
      return { ok: true, offline: true, id: queued.id } as T;
    }
    throw err;
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
