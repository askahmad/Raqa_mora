"use client";

/**
 * RAQAMORA application shell — premium midnight-navy sidebar (desktop),
 * translucent topbar, and fluid native mobile bottom bar with central FAB.
 */
import * as React from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  Ellipsis,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Plus,
  Repeat,
  Settings,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/raqamora/types";
import type { ViewKey } from "@/components/raqamora/view-props";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Monogram, RaqamoraWordmark } from "@/components/raqamora/brand";
import { InstallPwaButton } from "@/components/raqamora/pwa-register";
import { LanguageSwitcher } from "@/components/raqamora/language-switcher";
import { useLanguage } from "@/lib/raqamora/i18n";

export type { ViewKey } from "@/components/raqamora/view-props";

export const NAV_SECTIONS: Array<{
  title?: string;
  items: Array<{ key: ViewKey; label: string; icon: LucideIcon }>;
}> = [
  {
    title: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "transactions", label: "Transactions", icon: ArrowLeftRight },
      { key: "accounts", label: "Accounts", icon: Wallet },
    ],
  },
  {
    title: "Khata & Ledger",
    items: [
      { key: "people", label: "People", icon: Users },
      { key: "debts", label: "Debts", icon: HandCoins },
    ],
  },
  {
    title: "Planning",
    items: [
      { key: "budgets", label: "Budgets", icon: Target },
      { key: "goals", label: "Goals", icon: PiggyBank },
      { key: "recurring", label: "Recurring", icon: Repeat },
    ],
  },
  {
    title: "System",
    items: [
      { key: "reports", label: "Reports", icon: BarChart3 },
      { key: "notifications", label: "Notifications", icon: Bell },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export const VIEW_META: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your money at a glance" },
  transactions: { title: "Transactions", subtitle: "Every rupee in and out" },
  accounts: { title: "Accounts", subtitle: "Cash, bank & mobile wallets" },
  people: { title: "People", subtitle: "Lends & borrowings by person" },
  debts: { title: "Debts", subtitle: "Receivables & payables" },
  budgets: { title: "Budgets", subtitle: "Monthly category limits" },
  goals: { title: "Goals", subtitle: "Savings targets" },
  recurring: { title: "Recurring", subtitle: "Automated income & bills" },
  reports: { title: "Reports", subtitle: "Insights & CSV export" },
  notifications: { title: "Notifications", subtitle: "Alerts & reminders" },
  settings: { title: "Settings", subtitle: "Preferences & data" },
};

export interface AppShellProps {
  user: SessionUser;
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
  unreadCount: number;
  onQuickAdd: () => void;
  onLogout: () => void | Promise<void>;
  children: React.ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function AppShell({
  user,
  view,
  onViewChange,
  unreadCount,
  onQuickAdd,
  onLogout,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const reduced = useReducedMotion();
  const { t, isUrdu } = useLanguage();
  const meta = t.viewMeta[view] ?? VIEW_META[view];

  const go = React.useCallback(
    (key: ViewKey) => {
      onViewChange(key);
      setSheetOpen(false);
    },
    [onViewChange],
  );

  const navButton = (
    item: { key: ViewKey; label: string; icon: LucideIcon },
    opts: { collapsed?: boolean } = {},
  ) => {
    const active = view === item.key;
    const Icon = item.icon;
    const label = t.nav[item.key] ?? item.label;
    const showBadge = item.key === "notifications" && unreadCount > 0;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => go(item.key)}
        aria-current={active ? "page" : undefined}
        title={opts.collapsed ? item.label : undefined}
        className={cn(
          "group relative flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98]",
          opts.collapsed ? "justify-center px-0" : "px-3",
          active ? "text-white font-semibold" : "text-slate-300/80 hover:bg-white/5 hover:text-white",
        )}
      >
        {active && (
          <motion.div
            layoutId="activeSidebarIndicator"
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-md shadow-emerald-950/40"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Icon
          className={cn(
            "relative z-10 size-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
            active ? "scale-105 text-white" : "opacity-75 group-hover:opacity-100",
          )}
          aria-hidden
        />
        {!opts.collapsed ? (
          <>
            <span className="relative z-10 truncate">{label}</span>
            {showBadge ? (
              <span className="relative z-10 ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-900 shadow-xs">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </>
        ) : null}
        {opts.collapsed && showBadge ? (
          <span className="absolute right-2 top-2 z-10 size-2 rounded-full bg-amber-400 ring-2 ring-slate-900" aria-hidden />
        ) : null}
      </button>
    );
  };

  const userBlock = (opts: { collapsed?: boolean } = {}) => (
    <div className="border-t border-white/10 p-3">
      {opts.collapsed ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out"
          className="size-10 w-full rounded-xl text-ivory/60 hover:bg-white/10 hover:text-ivory"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl p-1.5">
          <Avatar className="size-9 border border-white/10 shrink-0">
            <AvatarFallback className="bg-gold/20 text-[11px] font-bold text-gold">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-ivory">{user.name}</span>
              {user.isDemo ? (
                <Badge className="border-gold/40 bg-gold/15 px-1 py-0 text-[8.5px] font-bold uppercase text-gold">
                  Demo
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-[11px] text-ivory/50">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="size-8 rounded-lg text-ivory/60 hover:bg-white/10 hover:text-ivory"
          >
            <LogOut className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      {/* ---------------- Desktop Sidebar ---------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col bg-navy text-ivory transition-[width] duration-200 ease-out md:flex shadow-xl",
        )}
        style={{ width: collapsed ? 64 : 240 }}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-white/10",
            collapsed ? "justify-center px-2" : "justify-between pl-4 pr-3",
          )}
        >
          {collapsed ? (
            <Monogram className="size-8" />
          ) : (
            <>
              <RaqamoraWordmark size="sm" tone="onDark" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="size-7 rounded-lg text-ivory/50 hover:bg-white/10 hover:text-gold"
              >
                <ChevronsLeft className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </div>

        {collapsed ? (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="size-8 rounded-lg text-ivory/50 hover:bg-white/10 hover:text-gold"
            >
              <ChevronsRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        <nav aria-label="Primary" className="flex-1 space-y-4 overflow-y-auto p-3">
          {NAV_SECTIONS.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && sec.title ? (
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ivory/40">
                  {sec.title}
                </p>
              ) : null}
              {sec.items.map((item) => navButton(item, { collapsed }))}
            </div>
          ))}
        </nav>

        {userBlock({ collapsed })}
      </aside>

      {/* ---------------- Content Column ---------------- */}
      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "md:pl-16" : "md:pl-[240px]",
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-hairline/80 bg-background/80 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
          <div className="flex h-14 md:h-16 items-center justify-between gap-3 px-3.5 sm:px-6">
            {/* Mobile Header Brand & Title */}
            <div className="flex items-center gap-2.5 md:hidden min-w-0">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex items-center gap-2 rounded-xl p-1 -ml-1 text-ink active:scale-95 transition-transform"
                aria-label="Open navigation menu"
              >
                <Monogram className="size-7 shrink-0" />
                <div className="min-w-0 text-left">
                  <span className="block truncate text-sm font-bold text-ink leading-tight">
                    {meta.title}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium text-ink-soft leading-none">
                    RAQAMORA
                  </span>
                </div>
              </button>
            </div>

            {/* Desktop Header Title */}
            <div className="hidden min-w-0 md:block">
              <h1 className="truncate text-base font-bold tracking-tight text-ink">
                {meta.title}
              </h1>
              <p className="truncate text-xs text-ink-soft">{meta.subtitle}</p>
            </div>

            {/* Actions (Desktop & Mobile) */}
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <InstallPwaButton className="hidden sm:inline-flex rounded-xl" />

              <Button
                onClick={onQuickAdd}
                size="sm"
                className="hidden sm:inline-flex h-9 rounded-xl bg-brand-emerald text-white font-semibold shadow-xs hover:bg-brand-emerald-deep active:scale-95 transition-transform"
              >
                <Plus className="size-4 mr-1" aria-hidden />
                {t.quickAdd}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="relative size-9 rounded-xl text-ink hover:bg-muted/60 active:scale-95 transition-transform"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                onClick={() => go("notifications")}
              >
                <Bell className="size-4.5" aria-hidden />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger-brand ring-2 ring-background" aria-hidden />
                ) : null}
              </Button>

              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="md:hidden flex size-8 items-center justify-center rounded-full bg-brand-emerald/15 text-[11px] font-bold text-brand-emerald ring-1 ring-hairline active:scale-95 transition-transform"
                aria-label="Profile and menu"
              >
                {initials(user.name)}
              </button>

              <Avatar className="hidden size-9 md:flex border border-hairline">
                <AvatarFallback className="bg-navy text-[11px] font-bold text-ivory">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1">
          <motion.div
            key={view}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mx-auto w-full max-w-6xl px-3.5 pb-24 pt-4 sm:px-6 md:pb-12 md:pt-6"
          >
            {children}
          </motion.div>
        </main>

        {/* Footer strip */}
        <footer className="hidden pb-6 pt-2 text-center md:block">
          <p className="text-[11.5px] font-medium tracking-wide text-ink-soft">
            RAQAMORA — Your Money. One Clear Picture.
          </p>
        </footer>
      </div>

      {/* ---------------- Mobile Bottom Navigation Bar ---------------- */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline/80 bg-card/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(16,28,44,0.05)] backdrop-blur-xl md:hidden"
      >
        <div className="flex h-16 items-center justify-around px-3">
          <MobileTab
            item={{ key: "dashboard", label: "Home", icon: LayoutDashboard }}
            active={view === "dashboard"}
            onClick={() => go("dashboard")}
          />
          <MobileTab
            item={{ key: "transactions", label: "Txns", icon: ArrowLeftRight }}
            active={view === "transactions"}
            onClick={() => go("transactions")}
          />

          {/* Elevated Center FAB */}
          <div className="relative -mt-6 flex items-start justify-center">
            <button
              type="button"
              onClick={onQuickAdd}
              aria-label="Quick add transaction"
              className="flex size-12 sm:size-13 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-emerald-deep to-brand-emerald text-white shadow-[0_8px_20px_-3px_rgba(22,131,111,0.5)] ring-4 ring-card active:scale-90 transition-transform duration-150 focus-visible:outline-none"
            >
              <Plus className="size-5.5 transition-transform" aria-hidden />
            </button>
          </div>

          <MobileTab
            item={{ key: "debts", label: "Debts", icon: HandCoins }}
            active={view === "debts"}
            onClick={() => go("debts")}
          />
          <MobileTab
            item={{ key: "settings", label: "More", icon: Menu }}
            active={!["dashboard", "transactions", "debts"].includes(view)}
            onClick={() => setSheetOpen(true)}
            badgeCount={unreadCount}
          />
        </div>
      </nav>

      {/* ---------------- Mobile Full Feature Sheet ---------------- */}
      <MobileNavSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={user}
        view={view}
        unreadCount={unreadCount}
        onNavigate={go}
        onLogout={onLogout}
      />
    </div>
  );
}

function MobileTab({
  item,
  active,
  onClick,
  badgeCount,
}: {
  item: { key: ViewKey; label: string; icon: LucideIcon };
  active: boolean;
  onClick: () => void;
  badgeCount?: number;
}) {
  const Icon = item.icon;
  const { t } = useLanguage();
  const label = item.key in t.nav ? t.nav[item.key] : item.label;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="group relative flex flex-1 flex-col items-center justify-center gap-1 py-1 transition-transform active:scale-90 focus-visible:outline-none"
    >
      <span className="relative flex h-7 w-12 items-center justify-center rounded-full">
        {active && (
          <motion.div
            layoutId="activeMobileTabIndicator"
            className="absolute inset-0 rounded-full bg-emerald-500/15"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Icon
          className={cn(
            "relative z-10 size-5 transition-transform duration-200",
            active ? "scale-105 stroke-[2.25] text-brand-emerald" : "text-slate-500 group-hover:text-slate-800",
          )}
          aria-hidden
        />
        {badgeCount && badgeCount > 0 ? (
          <span className="absolute -top-0.5 right-1.5 z-20 size-2 rounded-full bg-rose-500 ring-2 ring-card" />
        ) : null}
      </span>
      <span
        className={cn(
          "text-[10px] tracking-tight transition-all duration-150",
          active ? "font-bold text-brand-emerald" : "font-medium text-slate-500",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function MobileNavSheet({
  open,
  onOpenChange,
  user,
  view,
  unreadCount,
  onNavigate,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  view: ViewKey;
  unreadCount: number;
  onNavigate: (v: ViewKey) => void;
  onLogout: () => void | Promise<void>;
}) {
  const { t } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[32px] border-t border-hairline bg-card p-0 shadow-2xl text-ink"
      >
        <SheetTitle className="sr-only">All Sections</SheetTitle>
        <SheetDescription className="sr-only">Navigate through all RAQAMORA modules</SheetDescription>

        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex flex-col items-center bg-card/95 pb-3 pt-3 backdrop-blur-md border-b border-hairline/60">
          <div className="h-1.5 w-12 rounded-full bg-ink/20" aria-hidden />
          <div className="mt-2.5 flex w-full items-center justify-between px-5">
            <div className="flex items-center gap-2">
              <Monogram className="size-6" />
              <span className="text-sm font-bold text-ink">RAQAMORA</span>
            </div>
            <span className="text-xs font-semibold text-ink-soft">
              All Modules
            </span>
          </div>
        </div>

        {/* Grid of features */}
        <div className="grid grid-cols-3 gap-2.5 p-4 sm:grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            const label = t.nav[item.key] ?? item.label;
            const showBadge = item.key === "notifications" && unreadCount > 0;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all duration-150 active:scale-95",
                  active
                    ? "border-brand-emerald bg-brand-emerald/10 text-brand-emerald shadow-xs"
                    : "border-hairline/70 bg-muted/30 text-ink hover:bg-muted/60",
                )}
              >
                <div
                  className={cn(
                    "relative flex size-11 items-center justify-center rounded-xl transition-colors",
                    active
                      ? "bg-brand-emerald text-white shadow-xs"
                      : "bg-card text-ink-soft border border-hairline shadow-2xs",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {showBadge ? (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger-brand text-[9px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </div>
                <span className="truncate text-xs font-semibold leading-tight">{label}</span>
              </button>
            );
          })}
        </div>

        {/* User Card & Sign Out */}
        <div className="border-t border-hairline/80 bg-muted/20 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-card p-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="size-10 border border-hairline">
                <AvatarFallback className="bg-brand-emerald/15 text-xs font-bold text-brand-emerald">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-bold text-ink">{user.name}</span>
                  {user.isDemo ? (
                    <Badge className="border-gold/40 bg-gold/15 px-1 py-0 text-[8.5px] font-bold uppercase text-gold">
                      Demo
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-[11px] text-ink-soft">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="h-9 shrink-0 gap-1.5 rounded-xl border-danger-brand/30 text-danger-brand hover:bg-danger-brand/10 hover:text-danger-brand active:scale-95"
            >
              <LogOut className="size-3.5" aria-hidden />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
