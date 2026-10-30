"use client";

/**
 * RAQAMORA app root — client-side state machine over a single `/` route.
 * Phases: loading → guest (landing/auth) → onboarding → app (AppShell + views).
 */
import * as React from "react";
import nextDynamic from "next/dynamic";
import type { ComponentType } from "react";

import { ApiError, apiGet, apiSend } from "@/lib/raqamora/client";
import type { SessionUser } from "@/lib/raqamora/types";
import type { ViewKey, ViewProps } from "@/components/raqamora/view-props";
import { AppShell } from "@/components/raqamora/shell";
import { Landing } from "@/components/raqamora/landing";
import { AuthScreen, type AuthMode } from "@/components/raqamora/auth-screen";
import { Onboarding } from "@/components/raqamora/onboarding";
import { Spinner } from "@/components/raqamora/kit";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Monogram } from "@/components/raqamora/brand";

/* ------------------------------------------------------------ View loading */

function ViewLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading view">
      <Spinner className="size-6" />
    </div>
  );
}

/**
 * Views live at `src/components/raqamora/views/<key>.tsx` (default export,
 * `ViewProps` signature). Next 16 requires next/dynamic options to be inline
 * object literals — do not extract them into a shared const.
 */
const VIEW_COMPONENTS: Record<ViewKey, ComponentType<ViewProps>> = {
  dashboard: nextDynamic(() => import("@/components/raqamora/views/dashboard"), { ssr: false, loading: () => <ViewLoading /> }),
  transactions: nextDynamic(() => import("@/components/raqamora/views/transactions"), { ssr: false, loading: () => <ViewLoading /> }),
  accounts: nextDynamic(() => import("@/components/raqamora/views/accounts"), { ssr: false, loading: () => <ViewLoading /> }),
  people: nextDynamic(() => import("@/components/raqamora/views/people"), { ssr: false, loading: () => <ViewLoading /> }),
  debts: nextDynamic(() => import("@/components/raqamora/views/debts"), { ssr: false, loading: () => <ViewLoading /> }),
  budgets: nextDynamic(() => import("@/components/raqamora/views/budgets"), { ssr: false, loading: () => <ViewLoading /> }),
  goals: nextDynamic(() => import("@/components/raqamora/views/goals"), { ssr: false, loading: () => <ViewLoading /> }),
  recurring: nextDynamic(() => import("@/components/raqamora/views/recurring"), { ssr: false, loading: () => <ViewLoading /> }),
  reports: nextDynamic(() => import("@/components/raqamora/views/reports"), { ssr: false, loading: () => <ViewLoading /> }),
  notifications: nextDynamic(() => import("@/components/raqamora/views/notifications"), { ssr: false, loading: () => <ViewLoading /> }),
  settings: nextDynamic(() => import("@/components/raqamora/views/settings"), { ssr: false, loading: () => <ViewLoading /> }),
};

const TransactionQuickAdd = nextDynamic(
  () => import("@/components/raqamora/views/transaction-quick-add"),
  { ssr: false, loading: () => <ViewLoading /> },
);

/* ---------------------------------------------------------------- Context */

export interface AppContextValue {
  user: SessionUser;
  setUser: (user: SessionUser) => void;
  view: ViewKey;
  setView: (view: ViewKey) => void;
  refreshUnread: () => Promise<void>;
  /** Call when any API call fails with 401 — returns the user to the guest phase. */
  handleUnauthorized: () => void;
}

const AppContext = React.createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp() must be used inside <AppRoot> (app phase)");
  return ctx;
}

/* ------------------------------------------------------------------ Boot */

function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ivory">
      <Monogram className="size-12" />
      <Spinner className="size-5" />
      <span className="sr-only">Loading RAQAMORA…</span>
    </div>
  );
}

type Phase = "loading" | "guest" | "onboarding" | "app";

export function AppRoot() {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [view, setView] = React.useState<ViewKey>("dashboard");
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [authMode, setAuthMode] = React.useState<AuthMode | null>(null);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  const enterAsUser = React.useCallback((u: SessionUser) => {
    setUser(u);
    setView("dashboard");
    setAuthMode(null);
    setPhase(u.onboarded ? "app" : "onboarding");
  }, []);

  const goGuest = React.useCallback(() => {
    setUser(null);
    setUnreadCount(0);
    setView("dashboard");
    setAuthMode(null);
    setQuickAddOpen(false);
    setPhase("guest");
  }, []);

  const handleUnauthorized = React.useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        goGuest();
        return true;
      }
      return false;
    },
    [goGuest],
  );

  const handleUnauthorizedCtx = React.useCallback(() => {
    goGuest();
  }, [goGuest]);

  /* Boot: who am I? */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { user: me } = await apiGet<{ user: SessionUser | null }>("/api/auth/me");
        if (!alive) return;
        if (me) enterAsUser(me);
        else setPhase("guest");
      } catch {
        if (alive) setPhase("guest");
      }
    })();
    return () => {
      alive = false;
    };
  }, [enterAsUser]);

  /* Unread notifications: fetch on app entry, then every 60s */
  const refreshUnread = React.useCallback(async () => {
    try {
      const { unread } = await apiGet<{ unread: number }>("/api/notifications");
      setUnreadCount(unread);
    } catch (err) {
      handleUnauthorized(err);
    }
  }, [handleUnauthorized]);

  React.useEffect(() => {
    if (phase !== "app") return;
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 60_000);
    return () => window.clearInterval(id);
  }, [phase, refreshUnread]);

  async function handleLogout() {
    try {
      await apiSend("/api/auth/logout", "POST");
    } catch {
      /* clearing local state regardless */
    }
    goGuest();
  }

  const ctx: AppContextValue | null = React.useMemo(() => {
    if (!user) return null;
    return {
      user,
      setUser,
      view,
      setView,
      refreshUnread,
      handleUnauthorized: handleUnauthorizedCtx,
    };
  }, [user, view, refreshUnread, handleUnauthorizedCtx]);

  if (phase === "loading") return <BootScreen />;

  if (phase === "guest") {
    if (authMode) {
      return <AuthScreen key={authMode} initialMode={authMode} onAuthed={enterAsUser} />;
    }
    return <Landing onEnterApp={enterAsUser} onSignIn={setAuthMode} />;
  }

  if (phase === "onboarding" && user) {
    return (
      <Onboarding
        user={user}
        onFinish={(u) => {
          setUser(u);
          setPhase("app");
        }}
      />
    );
  }

  if (!user || !ctx) return <BootScreen />;

  const ActiveView = VIEW_COMPONENTS[view];

  return (
    <AppContext.Provider value={ctx}>
      <AppShell
        user={user}
        view={view}
        onViewChange={setView}
        unreadCount={unreadCount}
        onQuickAdd={() => setQuickAddOpen(true)}
        onLogout={handleLogout}
      >
        <ActiveView user={user} onViewChange={setView} />
      </AppShell>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick add</DialogTitle>
            <DialogDescription>
              Log income, expenses, transfers or person-wise ledger entries in seconds.
            </DialogDescription>
          </DialogHeader>
          <TransactionQuickAdd
            onSaved={() => {
              setQuickAddOpen(false);
              void refreshUnread();
              window.dispatchEvent(new Event("raqamora:txn-changed"));
            }}
          />
        </DialogContent>
      </Dialog>
    </AppContext.Provider>
  );
}

export default AppRoot;
