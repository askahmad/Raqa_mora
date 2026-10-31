"use client";

import * as React from "react";
import { Download, WifiOff, RefreshCw, CloudCheck, Check } from "lucide-react";
import {
  getOfflineQueue,
  isOnline,
  promptPwaInstall,
  subscribeInstallable,
  subscribeNetworkStatus,
  syncOfflineQueue,
} from "@/lib/raqamora/offline-sync";
import { Button } from "@/components/ui/button";

export function PwaRegister() {
  const [online, setOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [canInstall, setCanInstall] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);

  React.useEffect(() => {
    // 1. Register Service Worker robustly (even if page is already loaded)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker registered with scope:", reg.scope);
            reg.update().catch(() => {});
          })
          .catch((err) => {
            console.warn("[PWA] Service Worker registration failed:", err);
          });
      };

      if (document.readyState === "complete" || document.readyState === "interactive") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW, { once: true });
      }
    }

    // 2. Initial state
    setOnline(isOnline());
    setPendingCount(getOfflineQueue().length);

    // 3. Network listener
    const unsubNet = subscribeNetworkStatus((isNetOnline) => {
      setOnline(isNetOnline);
      const queueLen = getOfflineQueue().length;
      setPendingCount(queueLen);
      if (isNetOnline && queueLen > 0) {
        setSyncing(true);
        void syncOfflineQueue().finally(() => {
          setSyncing(false);
          setPendingCount(getOfflineQueue().length);
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 3000);
        });
      }
    });

    // 4. Queue updates listener
    const onQueueUpdate = (e: any) => {
      setPendingCount(e.detail?.count ?? getOfflineQueue().length);
    };
    window.addEventListener("raqamora:sync-queue-updated", onQueueUpdate);
    window.addEventListener("raqamora:txn-changed", () => {
      setPendingCount(getOfflineQueue().length);
    });

    // 5. Sync on focus if back online
    const onFocus = () => {
      if (isOnline() && getOfflineQueue().length > 0) {
        void syncOfflineQueue().then(() => {
          setPendingCount(getOfflineQueue().length);
        });
      }
    };
    window.addEventListener("focus", onFocus);

    // 6. Installable listener
    const unsubInstall = subscribeInstallable((installable) => {
      setCanInstall(installable);
    });

    // 7. Initial sync attempt if online and has pending queue
    if (isOnline() && getOfflineQueue().length > 0) {
      void syncOfflineQueue().then(() => {
        setPendingCount(getOfflineQueue().length);
      });
    }

    return () => {
      unsubNet();
      unsubInstall();
      window.removeEventListener("raqamora:sync-queue-updated", onQueueUpdate);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function handleManualSync() {
    setSyncing(true);
    try {
      const res = await syncOfflineQueue();
      setPendingCount(getOfflineQueue().length);
      if (res.synced > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      {/* Offline banner */}
      {!online && (
        <aside
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] flex items-center justify-between gap-3 bg-amber-600 px-4 py-2 text-xs font-medium text-white shadow-md animate-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="size-4 shrink-0 animate-pulse text-amber-200" />
            <span className="truncate">
              Aap offline hain. Aapka data phone me save ho raha hai aur net aane par khud live ho jayega.
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-0.5 font-bold text-[11px] tracking-wide">
              {pendingCount} pending
            </span>
          )}
        </aside>
      )}

      {/* Online with pending items banner */}
      {online && pendingCount > 0 && (
        <aside
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] flex items-center justify-between gap-3 bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-md animate-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-2 min-w-0">
            <RefreshCw className={syncing ? "size-4 shrink-0 animate-spin" : "size-4 shrink-0"} />
            <span className="truncate">
              Net connect ho gaya. {pendingCount} offline {pendingCount === 1 ? "entry" : "entries"} live ho rahi {pendingCount === 1 ? "hai" : "hain"}...
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={syncing}
            className="h-7 shrink-0 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </aside>
      )}

      {/* Just synced toast confirmation banner */}
      {online && pendingCount === 0 && justSynced && (
        <aside
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm animate-in fade-in duration-200"
        >
          <Check className="size-3.5" />
          <span>Tamam offline entries live ho chuki hain!</span>
        </aside>
      )}
    </>
  );
}

export function InstallPwaButton({ className }: { className?: string }) {
  const [canInstall, setCanInstall] = React.useState(false);

  React.useEffect(() => {
    return subscribeInstallable((installable) => {
      setCanInstall(installable);
    });
  }, []);

  if (!canInstall) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => void promptPwaInstall()}
    >
      <Download className="mr-1.5 size-3.5" />
      Install App
    </Button>
  );
}
