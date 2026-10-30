"use client";

/**
 * RAQAMORA Notifications view — alerts for budget pressure, overdue/due debts
 * and upcoming recurring rules. The first visit per session regenerates alerts
 * server-side (module-level flag) so nothing is missed, then the list loads.
 */
import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BellOff,
  CheckCheck,
  HandCoins,
  Info,
  PiggyBank,
  RefreshCw,
  Repeat,
  Target,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend } from "@/lib/raqamora/client";
import type { NotificationRow } from "@/lib/raqamora/types";
import { useApp } from "@/components/raqamora/app-root";
import { EmptyState, PageHeader, SkeletonList, Spinner } from "@/components/raqamora/kit";
import type { ViewKey, ViewProps } from "@/components/raqamora/view-props";
import { useUnauthorizedGuard } from "@/components/raqamora/views/transaction-quick-add";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Auto-detect runs only once per browser session to avoid spamming the API. */
let autoGenerateStarted = false;

/* --------------------------------------------------------------- kind meta */

const KIND_META: Record<string, { icon: LucideIcon; tile: string }> = {
  BUDGET_WARN: { icon: Target, tile: "bg-warn-brand/10 text-warn-brand" },
  BUDGET_OVER: { icon: Target, tile: "bg-danger-brand/10 text-danger-brand" },
  WARN: { icon: Target, tile: "bg-warn-brand/10 text-warn-brand" },
  DEBT_DUE: { icon: HandCoins, tile: "bg-warn-brand/10 text-warn-brand" },
  DEBT_OVERDUE: { icon: HandCoins, tile: "bg-danger-brand/10 text-danger-brand" },
  RECURRING_DUE: {
    icon: Repeat,
    tile: "bg-navy/[0.07] text-navy dark:bg-ivory/10 dark:text-ivory",
  },
  GOAL_DONE: { icon: PiggyBank, tile: "bg-brand-emerald/10 text-brand-emerald" },
  INFO: { icon: Info, tile: "bg-navy/[0.07] text-navy dark:bg-ivory/10 dark:text-ivory" },
};

function kindMeta(kind: string): { icon: LucideIcon; tile: string } {
  return KIND_META[kind] ?? KIND_META.INFO;
}

function navTargetFor(kind: string): { label: string; view: ViewKey } | null {
  if (kind.startsWith("DEBT_")) return { label: "View debts", view: "debts" };
  if (kind.startsWith("BUDGET_")) return { label: "View budgets", view: "budgets" };
  if (kind === "RECURRING_DUE") return { label: "View recurring", view: "recurring" };
  return null;
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------- View */

export default function NotificationsView(_props: ViewProps) {
  const { setView, refreshUnread } = useApp();
  const guard = useUnauthorizedGuard();
  const [items, setItems] = React.useState<NotificationRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const { notifications } = await apiGet<{ notifications: NotificationRow[] }>("/api/notifications");
      setItems(notifications);
    } catch (err) {
      if (guard(err)) return;
      setLoadError(err instanceof Error ? err.message : "Could not load notifications");
    }
  }, [guard]);

  const refreshUnreadRef = React.useRef(refreshUnread);
  React.useEffect(() => {
    refreshUnreadRef.current = refreshUnread;
  }, [refreshUnread]);

  /* First visit this session: regenerate alerts, then load the list. */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!autoGenerateStarted) {
        autoGenerateStarted = true;
        try {
          await apiSend("/api/notifications/generate", "POST");
          if (alive) void refreshUnreadRef.current();
        } catch (err) {
          if (guard(err)) return;
          /* non-fatal — the list still loads */
        }
      }
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load, guard]);

  async function checkNow() {
    setChecking(true);
    try {
      const { created } = await apiSend<{ created: number }>("/api/notifications/generate", "POST");
      toast.success(
        created > 0
          ? `${created} new notification${created === 1 ? "" : "s"}`
          : "No new alerts — you're all caught up",
      );
      await load();
      await refreshUnread();
    } catch (err) {
      if (guard(err)) return;
      toast.error(err instanceof Error ? err.message : "Could not check for alerts");
    } finally {
      setChecking(false);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await apiSend("/api/notifications/read-all", "POST");
      setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
      await refreshUnread();
      toast.success("All notifications marked as read");
    } catch (err) {
      if (guard(err)) return;
      toast.error(err instanceof Error ? err.message : "Could not mark everything read");
    } finally {
      setMarkingAll(false);
    }
  }

  async function markRead(n: NotificationRow) {
    if (n.read) return;
    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
    try {
      await apiSend(`/api/notifications/${n.id}`, "PATCH", { read: true });
      await refreshUnread();
    } catch (err) {
      if (guard(err)) return;
      void load(); // revert optimistic update
    }
  }

  const unreadCount = (items ?? []).filter((n) => !n.read).length;

  function renderList(list: NotificationRow[], empty: React.ReactNode) {
    if (items === null && !loadError) return <SkeletonList rows={4} />;
    if (loadError) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-brand/25 bg-danger-brand/[0.05] px-4 py-3">
          <p className="text-sm text-danger-brand">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      );
    }
    if (list.length === 0) return empty;
    return (
      <div className="space-y-2" role="list">
        {list.map((n) => {
          const meta = kindMeta(n.kind);
          const nav = navTargetFor(n.kind);
          const Icon = meta.icon;
          return (
            <div
              key={n.id}
              role="listitem"
              className={cn(
                "flex items-start gap-3 rounded-lg border border-hairline p-3 transition-colors",
                n.read ? "bg-card" : "border-brand-emerald/20 bg-brand-emerald/[0.045]",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  meta.tile,
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => void markRead(n)}
                aria-label={n.read ? n.title : `${n.title} — mark as read`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={cn("text-sm leading-snug", n.read ? "font-medium text-ink-soft" : "font-semibold text-ink")}>
                    {n.title}
                  </span>
                  <time className="shrink-0 pt-0.5 text-[10px] text-ink-soft">{relativeTime(n.createdAt)}</time>
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{n.message}</span>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {!n.read ? (
                  <span
                    className="size-2 rounded-full bg-brand-emerald"
                    role="img"
                    aria-label="Unread"
                  />
                ) : null}
                {nav ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => {
                      void markRead(n);
                      setView(nav.view);
                    }}
                  >
                    {nav.label}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const allEmpty = (
    <EmptyState
      icon={Bell}
      title="You're all caught up"
      description="Budget pressure, due debts and upcoming rules will appear here as they arise."
      actionLabel="Check now"
      onAction={() => void checkNow()}
    />
  );

  const unreadEmpty = (
    <EmptyState
      icon={BellOff}
      title="You're all caught up"
      description="No unread notifications. Check again anytime — new alerts are detected against your latest data."
      actionLabel="Check now"
      onAction={() => void checkNow()}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Budget warnings, debt deadlines and recurring reminders."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => void checkNow()} disabled={checking}>
              {checking ? <Spinner className="size-4 text-current" /> : <RefreshCw className="size-4" aria-hidden />}
              Check now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void markAllRead()}
              disabled={markingAll || unreadCount === 0}
            >
              {markingAll ? (
                <Spinner className="size-4 text-current" />
              ) : (
                <CheckCheck className="size-4" aria-hidden />
              )}
              Mark all read
            </Button>
          </>
        }
      />

      <Tabs defaultValue="all">
        <TabsList className="h-9">
          <TabsTrigger value="all" className="px-3 text-xs">
            All
            {items && items.length > 0 ? (
              <Badge variant="outline" className="ml-1.5 px-1 text-[10px] text-ink-soft">
                {items.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="unread" className="px-3 text-xs">
            Unread
            {unreadCount > 0 ? (
              <Badge
                variant="outline"
                className="ml-1.5 border-brand-emerald/25 bg-brand-emerald/10 px-1 text-[10px] text-brand-emerald-deep dark:text-[#53c6ac]"
              >
                {unreadCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-3">
          {renderList(items ?? [], allEmpty)}
        </TabsContent>
        <TabsContent value="unread" className="mt-3">
          {renderList(
            (items ?? []).filter((n) => !n.read),
            unreadEmpty,
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
