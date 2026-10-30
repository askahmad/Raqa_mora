"use client";

import * as React from "react";
import { Download, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
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

  React.useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Service Worker registration failed:", err);
          });
      });
    }

    // 2. Initial state
    setOnline(isOnline());
    setPendingCount(getOfflineQueue().length);

    // 3. Network listener
    const unsubNet = subscribeNetworkStatus((isNetOnline) => {
      setOnline(isNetOnline);
      setPendingCount(getOfflineQueue().length);
    });

    // 4. Queue updates listener
    const onQueueUpdate = (e: any) => {
      setPendingCount(e.detail?.count ?? getOfflineQueue().length);
    };
    window.addEventListener("raqamora:sync-queue-updated", onQueueUpdate);

    // 5. Installable listener
    const unsubInstall = subscribeInstallable((installable) => {
      setCanInstall(installable);
    });

    // 6. If currently online, try initial sync
    if (isOnline()) {
      void syncOfflineQueue();
    }

    return () => {
      unsubNet();
      unsubInstall();
      window.removeEventListener("raqamora:sync-queue-updated", onQueueUpdate);
    };
  }, []);

  async function handleManualSync() {
    setSyncing(true);
    try {
      await syncOfflineQueue();
      setPendingCount(getOfflineQueue().length);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      {/* Offline banner */}
      {!online && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-warn-brand px-4 py-2 text-xs font-medium text-white shadow-md">
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 shrink-0 animate-pulse" />
            <span>
              You are offline. Transactions and changes are being saved locally and will auto-sync when back online.
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="rounded-full bg-black/20 px-2.5 py-0.5 font-semibold text-[11px]">
              {pendingCount} pending
            </span>
          )}
        </div>
      )}

      {/* Online with pending items banner */}
      {online && pendingCount > 0 && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-brand-emerald px-4 py-2 text-xs font-medium text-white shadow-md">
          <div className="flex items-center gap-2">
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
            <span>
              Back online. {pendingCount} offline change{pendingCount === 1 ? "" : "s"} ready to sync.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={syncing}
            className="h-7 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            {syncing ? "Syncing..." : "Sync now"}
          </Button>
        </div>
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
