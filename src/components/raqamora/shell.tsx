"use client";

/**
 * RAQAMORA application shell — collapsible navy sidebar (md+), sticky topbar,
 * mobile sheet nav + thumb-zone bottom tab bar with a central emerald FAB.
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

export const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { key: "accounts", label: "Accounts", icon: Wallet },
  { key: "people", label: "People", icon: Users },
  { key: "debts", label: "Debts", icon: HandCoins },
  { key: "budgets", label: "Budgets", icon: Target },
  { key: "goals", label: "Goals", icon: PiggyBank },
  { key: "recurring", label: "Recurring", icon: Repeat },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings },
];

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

export function AppShell({ user, view, onViewChange, unreadCount, onQuickAdd, onLogout, children }: AppShellProps) {
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

  const navButton = (item: { key: ViewKey; label: string; icon: LucideIcon }, opts: { collapsed?: boolean; inSheet?: boolean } = {}) => {
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
          "group relative flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60",
          opts.collapsed ? "justify-center px-0" : "px-3",
          active
            ? "bg-brand-emerald text-white shadow-card"
            : "text-ivory/65 hover:bg-white/5 hover:text-gold",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {!opts.collapsed ? (
          <>
            <span className="truncate">{label}</span>
            {showBadge ? (
              <span className="ml-auto rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-semibold leading-none text-navy">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </>
        ) : null}
        {opts.collapsed && showBadge ? (
          <span className="absolute right-2 top-1.5 size-2 rounded-full bg-gold" aria-hidden />
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
          className="size-10 w-full text-ivory/60 hover:bg-white/10 hover:text-ivory"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      ) : (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9">
            <AvatarFallback className="bg-gold/20 text-[11px] font-semibold text-gold">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-ivory">{user.name}</span>
              {user.isDemo ? (
                <Badge className="border-gold/40 bg-gold/15 px-1 py-0 text-[9px] font-semibold uppercase tracking-wide text-gold">
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
            className="size-8 text-ivory/60 hover:bg-white/10 hover:text-ivory"
          >
            <LogOut className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );

  const mobileTabs: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
    { key: "dashboard", label: "Home", icon: LayoutDashboard },
    { key: "transactions", label: "Txns", icon: ArrowLeftRight },
    { key: "debts", label: "Debts", icon: HandCoins },
  ];

  return (
    <div className="min-h-dvh bg-background">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col bg-navy text-ivory transition-[width] duration-200 ease-out md:flex",
        )}
        style={{ width: collapsed ? 64 : 232 }}
      >
        <div className={cn("flex h-14 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "justify-between pl-4 pr-2")}>
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
                className="size-7 text-ivory/50 hover:bg-white/10 hover:text-gold"
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
              className="size-9 text-ivory/50 hover:bg-white/10 hover:text-gold"
            >
              <ChevronsRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-2">
          {NAV_ITEMS.map((item) => navButton(item, { collapsed }))}
        </nav>

        {userBlock({ collapsed })}
      </aside>

      {/* ---------------- Content column ---------------- */}
      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "md:pl-16" : "md:pl-[232px]",
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-hairline bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:hidden"
              aria-label="Open menu"
              onClick={() => setSheetOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
            <MobileNavSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              user={user}
              view={view}
              unreadCount={unreadCount}
              onNavigate={go}
              onLogout={onLogout}
              navButton={navButton}
              userBlock={userBlock}
            />

            <div className="md:hidden">
              <RaqamoraWordmark size="sm" />
            </div>

            <div className="hidden min-w-0 md:block">
              <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-ink">
                {meta.title}
              </h1>
              <p className="truncate text-xs leading-tight text-ink-soft">{meta.subtitle}</p>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <LanguageSwitcher />
              <InstallPwaButton />
              <Button onClick={onQuickAdd} size="sm" className="hidden min-h-9 sm:inline-flex">
                <Plus className="size-4" aria-hidden />
                {t.quickAdd}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-11 md:hidden"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                onClick={() => go("notifications")}
              >
                <Bell className="size-5" aria-hidden />
                {unreadCount > 0 ? (
                  <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger-brand" aria-hidden />
                ) : null}
              </Button>
              <Avatar className="hidden size-9 md:flex">
                <AvatarFallback className="bg-navy text-[11px] font-semibold text-ivory">
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
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-4 md:pb-10 md:pt-6"
          >
            {children}
          </motion.div>
        </main>

        {/* Footer strip */}
        <footer className="pb-20 pt-2 md:pb-5">
          <p className="text-center text-[11px] tracking-wide text-muted-foreground">
            RAQAMORA — Your Money. One Clear Picture.
          </p>
        </footer>
      </div>

      {/* ---------------- Mobile bottom tabs ---------------- */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-stretch">
          {mobileTabs.slice(0, 2).map((t) => (
            <MobileTab key={t.key} item={t} active={view === t.key} onClick={() => go(t.key)} />
          ))}
          <div className="relative flex items-start justify-center">
            <button
              type="button"
              onClick={onQuickAdd}
              aria-label="Quick add transaction"
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-brand-emerald text-white shadow-raised ring-4 ring-background transition-colors hover:bg-brand-emerald-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          </div>
          {mobileTabs.slice(2).map((t) => (
            <MobileTab key={t.key} item={t} active={view === t.key} onClick={() => go(t.key)} />
          ))}
          <MobileTab
            item={{ key: "notifications", label: "More", icon: Ellipsis }}
            active={view === "notifications" || view === "settings"}
            onClick={() => setSheetOpen(true)}
          />
        </div>
      </nav>
    </div>
  );
}

function MobileTab({
  item,
  active,
  onClick,
}: {
  item: { key: ViewKey; label: string; icon: LucideIcon };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const { t } = useLanguage();
  const label = item.key in t.nav ? t.nav[item.key] : item.label;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 pt-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-brand-emerald" : "text-ink-soft hover:text-ink",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
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
  navButton,
  userBlock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  view: ViewKey;
  unreadCount: number;
  onNavigate: (v: ViewKey) => void;
  onLogout: () => void | Promise<void>;
  navButton: (
    item: { key: ViewKey; label: string; icon: LucideIcon },
    opts?: { collapsed?: boolean; inSheet?: boolean },
  ) => React.ReactNode;
  userBlock: (opts?: { collapsed?: boolean }) => React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] border-r-0 bg-navy p-0 text-ivory">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SheetDescription className="sr-only">Move between RAQAMORA sections</SheetDescription>
        <div className="flex h-14 items-center border-b border-white/10 px-4">
          <RaqamoraWordmark size="sm" tone="onDark" />
        </div>
        <nav aria-label="Primary mobile menu" className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => navButton(item, { inSheet: true }))}
        </nav>
        {userBlock()}
      </SheetContent>
    </Sheet>
  );
}
