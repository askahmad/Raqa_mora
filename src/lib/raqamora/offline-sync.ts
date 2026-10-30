/**
 * RAQAMORA Offline Sync & Storage Engine
 * 
 * Provides:
 * 1. Offline Mutation Queue (IndexedDB / LocalStorage)
 * 2. Cached GET read model for seamless offline browsing
 * 3. Background / Online Reconnection Auto-Sync
 * 4. PWA Installation manager for Mobile & Desktop
 */
import { toast } from "sonner";

export interface QueuedMutation {
  id: string;
  path: string;
  method: "POST" | "PATCH" | "DELETE";
  payload?: unknown;
  createdAt: number;
  title: string;
}

const QUEUE_STORAGE_KEY = "raqamora_offline_queue_v1";
const CACHE_PREFIX = "raqamora_cache_v1:";

/* ------------------------------------------------------------- Network status */

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

const networkListeners = new Set<(online: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    networkListeners.forEach((fn) => fn(true));
    void syncOfflineQueue();
  });
  window.addEventListener("offline", () => {
    networkListeners.forEach((fn) => fn(false));
    toast.info("Offline mode active. Changes will be saved locally and auto-synced when back online.");
  });
}

export function subscribeNetworkStatus(callback: (online: boolean) => void): () => void {
  networkListeners.add(callback);
  return () => networkListeners.delete(callback);
}

/* ------------------------------------------------------------- Offline Queue */

export function getOfflineQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: QueuedMutation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("raqamora:sync-queue-updated", { detail: { count: queue.length } }));
  } catch (err) {
    console.error("[offline-sync] Could not write offline queue to localStorage", err);
  }
}

export function enqueueMutation(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  payload?: unknown,
  title?: string
): QueuedMutation {
  const item: QueuedMutation = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    path,
    method,
    payload,
    createdAt: Date.now(),
    title: title || inferMutationTitle(path, method, payload),
  };

  const current = getOfflineQueue();
  current.push(item);
  saveOfflineQueue(current);

  toast.info(`Offline: “${item.title}” saved locally. Will sync automatically once connected.`, {
    duration: 4500,
  });

  return item;
}

export function removeMutation(id: string): void {
  const current = getOfflineQueue();
  const next = current.filter((item) => item.id !== id);
  saveOfflineQueue(next);
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

function inferMutationTitle(path: string, method: string, payload: unknown): string {
  if (path.includes("/transactions")) return "Transaction";
  if (path.includes("/accounts")) return "Account";
  if (path.includes("/debts")) return "Debt / Khata";
  if (path.includes("/budgets")) return "Budget";
  if (path.includes("/goals")) return "Savings Goal";
  if (path.includes("/recurring")) return "Recurring Rule";
  if (path.includes("/categories")) return "Category";
  return `${method} ${path}`;
}

/* ------------------------------------------------------------- Offline Read Cache */

export function setCachedGet(path: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    // Only cache reasonable json responses
    localStorage.setItem(
      `${CACHE_PREFIX}${path}`,
      JSON.stringify({
        cachedAt: Date.now(),
        data,
      })
    );
  } catch {
    /* ignore storage quota limits */
  }
}

export function getCachedGet<T>(path: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${path}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed?.data as T) ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- Auto-Sync Engine */

let isSyncing = false;

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof window === "undefined") return { synced: 0, failed: 0 };
  if (!isOnline() || isSyncing) return { synced: 0, failed: 0 };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    for (const item of queue) {
      try {
        const res = await fetch(item.path, {
          method: item.method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: item.payload === undefined ? undefined : JSON.stringify(item.payload),
        });

        if (res.ok) {
          removeMutation(item.id);
          synced++;
        } else if (res.status >= 400 && res.status < 500) {
          // Client or validation error — remove so queue is not permanently blocked
          removeMutation(item.id);
          failed++;
        } else {
          // Server 5xx or network glitch — stop and retry later
          break;
        }
      } catch {
        // Still no connectivity
        break;
      }
    }

    if (synced > 0) {
      toast.success(`Internet Restored: ${synced} offline item${synced === 1 ? "" : "s"} successfully synced!`);
      // Trigger app views to refresh their data
      window.dispatchEvent(new CustomEvent("raqamora:txn-changed"));
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/* ------------------------------------------------------------- PWA Install Prompt */

let deferredPrompt: any = null;
const installListeners = new Set<(canInstall: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((fn) => fn(true));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
    toast.success("RAQAMORA installed successfully on your device!");
  });
}

export function subscribeInstallable(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(Boolean(deferredPrompt));
  return () => installListeners.delete(callback);
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
    return outcome === "accepted";
  } catch {
    return false;
  }
}

