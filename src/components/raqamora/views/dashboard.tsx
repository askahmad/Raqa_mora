"use client";

/**
 * RAQAMORA Dashboard — period-aware money overview: metric row, money-owed
 * band, flow/category/trend/budget charts, upcoming & overdue items, recent
 * transactions and highlights. All amounts are integer paisa rendered via the
 * shared <Money> kit; every figure is Asia/Karachi-aware.
 */
import * as React from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  CreditCard,
  HandCoins,
  Plus,
  Receipt,
  Repeat,
  Scale,
  Sparkles,
  Target,
  TriangleAlert,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/raqamora/money";
import { accountDelta, TXN_TYPE_LABELS, type TxnType } from "@/lib/raqamora/finance";
import type { DashboardData, SessionUser, TxnRow } from "@/lib/raqamora/types";
import { ApiError, apiGet } from "@/lib/raqamora/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DemoButton,
  EmptyState,
  Money,
  PageHeader,
  SectionCard,
  SkeletonList,
  StatCard,
  TypeBadge,
} from "@/components/raqamora/kit";
import { AppIcon } from "@/components/raqamora/icon";
import { useApp } from "@/components/raqamora/app-root";
import type { ViewProps } from "@/components/raqamora/view-props";

/* ------------------------------------------------------------------ consts */

const KARACHI_TZ = "Asia/Karachi";
const DAY_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: KARACHI_TZ, day: "numeric", month: "short" });
const DAY_FULL_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: KARACHI_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: KARACHI_TZ, month: "short", year: "2-digit" });

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#5c8577",
  "#8fa38f",
  "#a3865f",
  "#7f8c99",
  "#b0a284",
];
const SCROLLBAR =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline [&::-webkit-scrollbar-track]:bg-transparent";

type RangeKey = "today" | "week" | "month" | "year" | "custom";

const RANGE_OPTIONS: Array<{ key: Exclude<RangeKey, "custom">; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

/* ----------------------------------------------------------------- helpers */

/** Karachi (UTC+5) calendar date as YYYY-MM-DD, optionally offset by days. */
function karachiDay(daysOffset = 0): string {
  return new Date(Date.now() + 5 * 3_600_000 + daysOffset * 86_400_000).toISOString().slice(0, 10);
}

function fmtDay(iso: string): string {
  return DAY_FMT.format(new Date(iso));
}

function fmtDayFull(iso: string): string {
  return DAY_FULL_FMT.format(new Date(iso));
}

function fmtMonthKey(key: string): string {
  return MONTH_FMT.format(new Date(`${key}-15T12:00:00Z`));
}

/** Chart axis labels accept day keys (YYYY-MM-DD) and month keys (YYYY-MM). */
function tickLabel(value: string): string {
  if (typeof value !== "string") return String(value);
  if (value.length === 7) return fmtMonthKey(value);
  if (value.length === 10) return DAY_FMT.format(new Date(`${value}T12:00:00Z`));
  return value;
}

/** Percent change vs the previous period; `invert` flags metrics where up = bad. */
function pctChange(
  current: number,
  previous: number,
  invert = false,
): { label: string; positive: boolean } | null {
  if (previous <= 0) {
    if (current <= 0) return null;
    return { label: "new", positive: !invert };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  return { label: `${pct > 0 ? "+" : ""}${pct}%`, positive: invert ? pct < 0 : pct > 0 };
}

function budgetTone(percent: number, threshold: number): { text: string; bar: string } {
  if (percent > 100) {
    return { text: "text-danger-brand", bar: "[&>[data-slot=progress-indicator]]:bg-danger-brand" };
  }
  if (percent >= threshold) {
    return { text: "text-warn-brand", bar: "[&>[data-slot=progress-indicator]]:bg-warn-brand" };
  }
  return { text: "text-brand-emerald-deep", bar: "[&>[data-slot=progress-indicator]]:bg-brand-emerald" };
}

/* -------------------------------------------------------------- chart bits */

function MoneyTip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const title = typeof label === "string" || typeof label === "number" ? tickLabel(String(label)) : "";
  return (
    <div className="rounded-lg border border-hairline bg-popover px-3 py-2 shadow-raised">
      {title ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{title}</p>
      ) : null}
      <div className={cn(title && "mt-1", "space-y-1")}>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.color ?? "var(--muted-foreground)" }}
              aria-hidden
            />
            <span className="text-ink-soft">{p.name ?? "Amount"}</span>
            <span className="money ml-auto pl-3 font-semibold text-ink">{formatPKR(Number(p.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <span className="size-2 rounded-full" style={{ background: it.color }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- row pieces */

function RecentTxnRow({ txn }: { txn: TxnRow }) {
  const isTransfer = txn.type === "TRANSFER";
  const delta = isTransfer ? txn.amount : accountDelta(txn.type as TxnType, txn.amount, txn.signed);
  const title = txn.categoryName ?? txn.personName ?? TXN_TYPE_LABELS[txn.type as TxnType] ?? "Transaction";
  const sub = isTransfer
    ? [txn.accountName, txn.toAccountName].filter(Boolean).join(" → ")
    : [txn.accountName, fmtDay(txn.date)].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft">
        {isTransfer ? (
          <ArrowLeftRight className="size-4" aria-hidden />
        ) : txn.categoryName ? (
          <AppIcon name={txn.categoryIcon} className="size-4" aria-hidden />
        ) : txn.personName ? (
          <User className="size-4" aria-hidden />
        ) : (
          <CreditCard className="size-4" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">
          {title}
          {txn.note ? <span className="text-ink-soft"> · {txn.note}</span> : null}
        </p>
        <p className="truncate text-[11px] text-ink-soft">{sub || "—"}</p>
      </div>
      <TypeBadge type={txn.type} className="hidden shrink-0 sm:inline-flex" />
      <Money value={isTransfer ? txn.amount : delta} colored={!isTransfer} size="sm" className="shrink-0" />
    </div>
  );
}

function UpcomingRow({
  item,
  onOpen,
}: {
  item: DashboardData["upcoming"][number];
  onOpen: () => void;
}) {
  const Icon = item.kind === "DEBT" ? HandCoins : Repeat;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none sm:px-5"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          item.overdue ? "bg-danger-brand/10 text-danger-brand" : "bg-muted text-ink-soft",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
        <p className="flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
          {fmtDayFull(item.date)}
          {item.overdue ? (
            <Badge
              variant="outline"
              className="border-danger-brand/30 bg-danger-brand/10 px-1.5 py-0 text-[10px] text-danger-brand"
            >
              Overdue
            </Badge>
          ) : null}
        </p>
      </div>
      {typeof item.amount === "number" ? <Money value={item.amount} size="sm" className="shrink-0" /> : null}
      <ChevronRight className="size-4 shrink-0 text-ink-soft" aria-hidden />
    </button>
  );
}

function OwedCard({
  title,
  amount,
  tone,
  people,
  onOpen,
}: {
  title: string;
  amount: number;
  tone: "pos" | "neg";
  people: Array<{ id: string; name: string; amount: number }>;
  onOpen: () => void;
}) {
  const moneyTone = tone === "pos" ? "text-money-pos" : "text-money-neg";
  return (
    <div className="rounded-2xl border border-hairline/80 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">{title}</p>
          <Money value={amount} size="lg" className={cn("mt-1 text-xl font-bold", moneyTone)} />
        </div>
        <Button variant="outline" size="sm" className="h-8 rounded-xl shrink-0 text-xs font-semibold active:scale-95 transition-transform" onClick={onOpen}>
          Debts
          <ArrowRight className="size-3.5 ml-1" aria-hidden />
        </Button>
      </div>
      {people.length > 0 ? (
        <div className="mt-3.5 space-y-2 border-t border-hairline/70 pt-3">
          {people.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-ink-soft font-medium">{p.name}</span>
              <Money value={p.amount} size="sm" className={cn("font-semibold", moneyTone)} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 border-t border-hairline/70 pt-2.5 text-xs text-ink-soft">
          Nothing outstanding — all settled.
        </p>
      )}
    </div>
  );
}

function FirstRunHero({
  onAddAccount,
  onDemo,
}: {
  onAddAccount: () => void;
  onDemo: (u: SessionUser) => void;
}) {
  const steps: Array<{ icon: LucideIcon; title: string; desc: string }> = [
    {
      icon: Wallet,
      title: "Add an account",
      desc: "Start with the cash in your wallet, a bank account, or Easypaisa.",
    },
    {
      icon: Receipt,
      title: "Record a transaction",
      desc: "Log income and expenses as they happen — every rupee counts.",
    },
    {
      icon: Sparkles,
      title: "Or explore the demo",
      desc: "Load a realistic Pakistan-themed sample book and click around.",
    },
  ];
  return (
    <section className="rounded-xl border border-hairline bg-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-emerald/10 text-brand-emerald">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">Welcome to RAQAMORA</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Your money, one clear picture. Get started in three quick steps.
          </p>
        </div>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <li key={s.title} className="rounded-lg border border-hairline bg-background/60 p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-ivory">
                  {i + 1}
                </span>
                <StepIcon className="size-4 shrink-0 text-brand-emerald" aria-hidden />
                <p className="text-[13px] font-semibold text-ink">{s.title}</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{s.desc}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onAddAccount}>
          <Plus className="size-4" aria-hidden />
          Add your first account
        </Button>
        <DemoButton onDemo={onDemo} label="Load demo data" />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- skeleton */

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-hairline bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-28" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-[248px] rounded-xl border border-hairline bg-card p-4">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ))}
      </div>
      <SkeletonList rows={4} />
    </div>
  );
}

/* -------------------------------------------------------------------- view */

export default function DashboardView({ user, onViewChange }: ViewProps) {
  const { setUser, handleUnauthorized } = useApp();
  const reduced = useReducedMotion();

  const [rangeKey, setRangeKey] = React.useState<RangeKey>("month");
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [customApplied, setCustomApplied] = React.useState<{ from: string; to: string } | null>(null);
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const dataRef = React.useRef<DashboardData | null>(null);
  const onUnauthorizedRef = React.useRef(handleUnauthorized);
  React.useEffect(() => {
    onUnauthorizedRef.current = handleUnauthorized;
  }, [handleUnauthorized]);

  const query = React.useMemo(() => {
    const sp = new URLSearchParams({ range: rangeKey });
    if (rangeKey === "custom" && customApplied) {
      sp.set("from", `${customApplied.from}T00:00:00+05:00`);
      sp.set("to", `${customApplied.to}T23:59:59.999+05:00`);
    }
    return sp.toString();
  }, [rangeKey, customApplied]);

  const load = React.useCallback(
    async (background = false) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiGet<DashboardData>(`/api/dashboard?${query}`);
        dataRef.current = payload;
        setData(payload);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorizedRef.current();
          return;
        }
        const msg = err instanceof Error ? err.message : "Something went wrong while loading the dashboard.";
        if (background && dataRef.current) toast.error(msg);
        else setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  React.useEffect(() => {
    void load();
  }, [load, user.id]);

  React.useEffect(() => {
    const handler = () => void load(true);
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, [load]);

  function openCustomDraft() {
    if (!customFrom) setCustomFrom(karachiDay(-29));
    if (!customTo) setCustomTo(karachiDay(0));
    setCustomOpen(true);
  }

  function applyCustom() {
    if (!customFrom || !customTo) {
      toast.error("Pick both a start and an end date.");
      return;
    }
    if (customFrom > customTo) {
      toast.error("The end date must be on or after the start date.");
      return;
    }
    setCustomApplied({ from: customFrom, to: customTo });
    setRangeKey("custom");
    setCustomOpen(false);
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Your money at a glance" />
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Your money at a glance" />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load your dashboard"
          description={error}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      </div>
    );
  }

  if (!data) return null;

  const d = data;
  const firstRun = d.accounts.length === 0 && d.recent.length === 0;

  const incomeTrend = d.comparison ? pctChange(d.summary.income, d.comparison.income) : null;
  const expenseTrend = d.comparison ? pctChange(d.summary.netExpense, d.comparison.expense, true) : null;

  const flowFromMonthly = d.charts.dailyFlow.length === 0 && rangeKey === "year";
  const flowSeries = flowFromMonthly
    ? d.charts.monthlyTrend.map((m) => ({ date: m.month, income: m.income, expense: m.expense }))
    : d.charts.dailyFlow;
  const flowMonthly = flowFromMonthly || (flowSeries.length > 0 && flowSeries[0].date.length === 7);
  const flowHasData = flowSeries.some((p) => p.income > 0 || p.expense > 0);

  const donut = d.charts.expenseByCategory;
  const donutTotal = donut.reduce((sum, c) => sum + c.value, 0);

  const trendHasData = d.charts.monthlyTrend.some((m) => m.income > 0 || m.expense > 0);
  const bu = d.budgetUsage;
  const overallTone = budgetTone(bu.percent, user.warnThreshold);

  const metrics: Array<{
    key: string;
    label: string;
    icon: LucideIcon;
    value: number;
    trend?: { label: string; positive: boolean } | null;
    sub?: string;
  }> = [
    {
      key: "balance",
      label: "Available balance",
      icon: Wallet,
      value: d.totalBalance,
      sub:
        d.accounts.length > 0
          ? `Across ${d.accounts.length} account${d.accounts.length === 1 ? "" : "s"}`
          : "No accounts yet",
    },
    { key: "income", label: "Income", icon: Banknote, value: d.summary.income, trend: incomeTrend },
    {
      key: "expense",
      label: "Net expenses",
      icon: Receipt,
      value: d.summary.netExpense,
      trend: expenseTrend,
      sub: d.summary.refunds > 0 ? `${formatPKR(d.summary.refunds)} refunded` : undefined,
    },
    {
      key: "netpos",
      label: "Net position",
      icon: Scale,
      value: d.netPosition,
      sub: "Cash + receivables − payables",
    },
  ];

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ Header & Period Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-ink">
            Assalam-o-Alaikum, {user.name.split(" ")[0]}
          </h1>
          <p className="text-xs text-ink-soft">
            {d.period.label === "Custom Range" && customApplied
              ? `${fmtDayFull(d.period.from)} – ${fmtDayFull(d.period.to)}`
              : d.period.label} · Financial Summary
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <div
            role="group"
            aria-label="Period"
            className="flex gap-1 rounded-2xl border border-hairline/80 bg-muted/40 p-1 shadow-2xs"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                aria-pressed={rangeKey === opt.key}
                onClick={() => setRangeKey(opt.key)}
                className={cn(
                  "relative min-h-8 shrink-0 rounded-xl px-3 text-[12px] font-medium transition-all duration-150 active:scale-95 focus-visible:outline-none",
                  rangeKey === opt.key ? "text-brand-emerald font-bold" : "text-slate-500 hover:text-slate-900",
                )}
              >
                {rangeKey === opt.key && (
                  <motion.div
                    layoutId="activePeriodIndicator"
                    className="absolute inset-0 rounded-xl bg-card shadow-xs border border-hairline/60"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{opt.label}</span>
              </button>
            ))}
          </div>

          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "min-h-8 h-8 rounded-xl px-2.5 text-xs active:scale-95 transition-transform",
                  rangeKey === "custom" && "border-brand-emerald/50 text-brand-emerald-deep font-semibold",
                )}
                onClick={() => {
                  if (customApplied) setRangeKey("custom");
                  else openCustomDraft();
                }}
              >
                <CalendarDays className="size-3.5 mr-1" aria-hidden />
                Custom
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-2xl">
              <div className="grid gap-3">
                <p className="text-sm font-semibold text-ink">Custom range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="rq-dash-from">From</Label>
                    <Input
                      id="rq-dash-from"
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="rq-dash-to">To</Label>
                    <Input
                      id="rq-dash-to"
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <Button size="sm" className="min-h-9 rounded-xl" onClick={applyCustom}>
                  Apply range
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {firstRun ? (
        <FirstRunHero onAddAccount={() => onViewChange("accounts")} onDemo={(u) => setUser(u)} />
      ) : (
        <>
          {/* ------------------------------------------------ Mobile Fintech Card Layout */}
          <div className="md:hidden space-y-3">
            {/* Luxury Metal Wallet Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy to-navy-raised p-5 text-ivory shadow-raised border border-white/10">
              {/* Subtle background glow circle */}
              <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-brand-emerald/20 blur-2xl" />
              <div className="pointer-events-none absolute -left-12 -bottom-12 size-36 rounded-full bg-gold/15 blur-2xl" />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ivory/60">
                  Total Available Balance
                </span>
                <span className="flex size-7 items-center justify-center rounded-xl bg-white/10 text-gold border border-white/10">
                  <Wallet className="size-3.5" aria-hidden />
                </span>
              </div>

              <div className="mt-2.5">
                <Money value={d.totalBalance} size="xl" className="text-3xl font-extrabold tracking-tight text-white" />
                <p className="mt-1 text-xs text-ivory/60 font-medium">
                  {d.accounts.length > 0
                    ? `Consolidated across ${d.accounts.length} account${d.accounts.length === 1 ? "" : "s"}`
                    : "No accounts added yet"}
                </p>
              </div>

              {/* Quick Action Chips */}
              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-white/10">
                <Button
                  size="sm"
                  className="h-8.5 flex-1 rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald text-white text-xs font-bold shadow-md shadow-emerald-600/30 hover:brightness-105 active:scale-95 transition-all"
                  onClick={() => window.dispatchEvent(new Event("raqamora:quick-add"))}
                >
                  <Plus className="size-3.5 mr-1" aria-hidden />
                  Add Entry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 rounded-xl text-xs font-medium border-white/15 bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-transform"
                  onClick={() => onViewChange("accounts")}
                >
                  <Wallet className="size-3.5 mr-1 text-ivory/70" aria-hidden />
                  Accounts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 rounded-xl text-xs font-medium border-white/15 bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-transform"
                  onClick={() => onViewChange("debts")}
                >
                  <HandCoins className="size-3.5 mr-1 text-ivory/70" aria-hidden />
                  Debts
                </Button>
              </div>
            </div>

            {/* Income & Expense (2 Clean Columns) */}
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard
                label="Income"
                value={d.summary.income}
                trend={incomeTrend ?? undefined}
                className="p-3.5 rounded-2xl"
              />
              <StatCard
                label="Expenses"
                value={d.summary.netExpense}
                trend={expenseTrend ?? undefined}
                className="p-3.5 rounded-2xl"
              />
            </div>

            {/* Net Position (Full width sleek banner) */}
            <div className="rounded-2xl border border-hairline/80 bg-card p-3.5 shadow-card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                  Net Financial Position
                </p>
                <p className="text-[11px] text-ink-soft mt-0.5">
                  Cash + Receivables − Payables
                </p>
              </div>
              <Money value={d.netPosition} size="lg" className="font-extrabold text-ink shrink-0" />
            </div>
          </div>

          {/* ------------------------------------------------ Desktop 4-Column Metric Row */}
          <div className="hidden md:grid md:grid-cols-4 gap-3.5">
            {metrics.map((m, i) => (
              <motion.div
                key={m.key}
                initial={reduced ? false : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: reduced ? 0 : i * 0.05 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
              >
                <StatCard
                  label={m.label}
                  value={m.value}
                  sub={m.sub}
                  icon={m.icon}
                  trend={m.trend ?? undefined}
                />
              </motion.div>
            ))}
          </div>

          {/* -------------------------------------------- money owed band */}
          <div className="grid gap-3 sm:grid-cols-2">
            <OwedCard
              title="To receive"
              amount={d.receivables}
              tone="pos"
              people={d.peopleWithBalances
                .filter((p) => p.receivable > 0)
                .slice(0, 2)
                .map((p) => ({ id: p.id, name: p.name, amount: p.receivable }))}
              onOpen={() => onViewChange("debts")}
            />
            <OwedCard
              title="To pay"
              amount={d.payables}
              tone="neg"
              people={d.peopleWithBalances
                .filter((p) => p.payable > 0)
                .slice(0, 2)
                .map((p) => ({ id: p.id, name: p.name, amount: p.payable }))}
              onOpen={() => onViewChange("debts")}
            />
          </div>

          {/* ---------------------------------------------------- charts */}
          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard
              title="Income vs Expenses"
              subtitle={flowMonthly ? "Monthly totals for the selected period" : "Daily totals for the selected period"}
            >
              {flowHasData ? (
                <>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={flowSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={tickLabel}
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tickFormatter={(v: number) => formatPKR(v, { compact: true })}
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        width={58}
                      />
                      <Tooltip content={<MoneyTip />} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
                      <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={16} />
                      <Bar dataKey="expense" name="Expense" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                  <MiniLegend
                    items={[
                      { label: "Income", color: "var(--chart-1)" },
                      { label: "Expense", color: "var(--chart-5)" },
                    ]}
                  />
                </>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No income or expenses yet"
                  description="Record a few transactions to see the flow here."
                  className="border-0 bg-transparent py-8"
                />
              )}
            </SectionCard>

            <SectionCard title="Expense by Category" subtitle="Where the money went">
              {donut.length > 0 && donutTotal > 0 ? (
                <>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Tooltip content={<MoneyTip />} />
                        <Pie
                          data={donut}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="62%"
                          outerRadius="90%"
                          paddingAngle={2}
                          stroke="var(--card)"
                          strokeWidth={2}
                        >
                          {donut.map((c, i) => (
                            <Cell key={`${c.name}-${i}`} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-soft">
                        Net spend
                      </span>
                      <Money value={donutTotal} size="md" />
                    </div>
                  </div>
                  <div className={cn("mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1", SCROLLBAR)}>
                    {donut.map((c, i) => (
                      <div key={`${c.name}-${i}`} className="flex items-center gap-2 text-xs">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          aria-hidden
                        />
                        <AppIcon name={c.icon} className="size-3.5 shrink-0 text-ink-soft" />
                        <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                        <span className="money shrink-0 text-ink-soft">
                          {donutTotal > 0 ? Math.round((c.value / donutTotal) * 100) : 0}%
                        </span>
                        <Money value={c.value} size="sm" className="shrink-0 text-ink" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No expenses in this period"
                  description="Once you log expenses, the category split appears here."
                  className="border-0 bg-transparent py-8"
                />
              )}
            </SectionCard>

            <SectionCard title="6-Month Trend" subtitle="Income vs expenses by month">
              {trendHasData ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={d.charts.monthlyTrend} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickFormatter={fmtMonthKey}
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        tickFormatter={(v: number) => formatPKR(v, { compact: true })}
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        width={58}
                      />
                      <Tooltip content={<MoneyTip />} cursor={{ stroke: "var(--border)" }} />
                      <Line
                        type="monotone"
                        dataKey="income"
                        name="Income"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        name="Expense"
                        stroke="var(--chart-5)"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <MiniLegend
                    items={[
                      { label: "Income", color: "var(--chart-1)" },
                      { label: "Expense", color: "var(--chart-5)" },
                    ]}
                  />
                </>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No trend data yet"
                  description="Your last six months of income and expenses will appear here."
                  className="border-0 bg-transparent py-8"
                />
              )}
            </SectionCard>

            <SectionCard
              title="Budget Health"
              subtitle={
                bu.totalLimit > 0
                  ? `${formatPKR(bu.totalUsed, { compact: true })} of ${formatPKR(bu.totalLimit, { compact: true })} used`
                  : "No budgets for this month yet"
              }
              action={
                <Button variant="ghost" size="sm" onClick={() => onViewChange("budgets")}>
                  Manage
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              }
            >
              {bu.totalLimit > 0 ? (
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-ink-soft">Overall this month</span>
                    <span className={cn("money text-sm font-semibold", overallTone.text)}>{bu.percent}%</span>
                  </div>
                  <Progress
                    value={Math.min(100, bu.percent)}
                    className={cn("mt-2 h-2", overallTone.bar)}
                    aria-label={`Overall budget usage ${bu.percent}%`}
                  />
                  {bu.warnings.length > 0 ? (
                    <div className="mt-4 space-y-3 border-t border-hairline pt-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">
                        Near or over the limit
                      </p>
                      {bu.warnings.slice(0, 3).map((w) => {
                        const tone = budgetTone(w.percent, user.warnThreshold);
                        return (
                          <div key={w.id}>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <AppIcon name={w.categoryIcon} className="size-3.5 shrink-0 text-ink-soft" />
                                <span className="truncate text-ink">{w.categoryName}</span>
                              </span>
                              <span className={cn("money shrink-0 font-medium", tone.text)}>{w.percent}%</span>
                            </div>
                            <Progress
                              value={Math.min(100, w.percent)}
                              className={cn("mt-1 h-1.5", tone.bar)}
                              aria-label={`${w.categoryName} budget usage ${w.percent}%`}
                            />
                          </div>
                        );
                      })}
                      {bu.warnings.length > 3 ? (
                        <p className="text-[11px] text-ink-soft">
                          +{bu.warnings.length - 3} more over {user.warnThreshold}% — see Budgets.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 border-t border-hairline pt-3 text-xs text-ink-soft">
                      All categories are comfortably within their limits.
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={Target}
                  title="No budgets yet"
                  description="Set monthly limits per category to spot overspending early."
                  actionLabel="Set a budget"
                  onAction={() => onViewChange("budgets")}
                  className="border-0 bg-transparent py-6"
                />
              )}
            </SectionCard>
          </div>

          {/* ---------------------------------------- upcoming & overdue */}
          <SectionCard
            title="Upcoming & Overdue"
            subtitle="Debts due within 30 days and recurring items due within 7"
            contentClassName={d.upcoming.length > 0 ? "p-0 sm:p-0" : undefined}
          >
            {d.upcoming.length > 0 ? (
              <div className={cn("max-h-64 divide-y divide-hairline overflow-y-auto", SCROLLBAR)}>
                {d.upcoming.slice(0, 6).map((item) => (
                  <UpcomingRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onOpen={() => onViewChange(item.kind === "DEBT" ? "debts" : "recurring")}
                  />
                ))}
                {d.upcoming.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => onViewChange("debts")}
                    className="flex w-full items-center justify-center px-4 py-2.5 text-xs font-medium text-brand-emerald-deep transition-colors hover:bg-accent/60 focus-visible:outline-none"
                  >
                    +{d.upcoming.length - 6} more due soon — open Debts
                  </button>
                ) : null}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Nothing due in the next 7 days"
                description="Debt due dates and recurring items will appear here."
                className="border-0 bg-transparent py-6"
              />
            )}
          </SectionCard>

          {/* ------------------------------------------ recent activity */}
          <SectionCard
            title="Recent Transactions"
            subtitle="Latest entries across all accounts"
            action={
              <Button variant="ghost" size="sm" onClick={() => onViewChange("transactions")}>
                View all
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            }
            contentClassName={d.recent.length > 0 ? "p-0 sm:p-0" : undefined}
          >
            {d.recent.length > 0 ? (
              <div className={cn("max-h-96 divide-y divide-hairline overflow-y-auto", SCROLLBAR)}>
                {d.recent.map((t) => (
                  <RecentTxnRow key={t.id} txn={t} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Use Quick add (the + button) to record your first entry."
                className="border-0 bg-transparent py-6"
              />
            )}
          </SectionCard>

          {/* ------------------------------------------------ highlights */}
          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard
              title="Largest Expenses"
              subtitle="Top 5 in the selected period"
              contentClassName={d.largestExpenses.length > 0 ? "p-0 sm:p-0" : undefined}
            >
              {d.largestExpenses.length > 0 ? (
                <div className="divide-y divide-hairline">
                  {d.largestExpenses.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft">
                        <AppIcon name={t.categoryIcon} className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {t.categoryName ?? t.note ?? "Expense"}
                        </p>
                        <p className="truncate text-[11px] text-ink-soft">
                          {[t.accountName, fmtDay(t.date)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Money value={t.amount} size="sm" className="shrink-0 text-danger-brand" />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No expenses in this period"
                  className="border-0 bg-transparent py-6"
                />
              )}
            </SectionCard>

            <SectionCard
              title="Frequently Used Categories"
              subtitle="Top 5 by transaction count"
              contentClassName={d.frequentCategories.length > 0 ? "p-0 sm:p-0" : undefined}
            >
              {d.frequentCategories.length > 0 ? (
                <div className="divide-y divide-hairline">
                  {d.frequentCategories.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft">
                        <AppIcon name={c.icon} className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{c.name}</p>
                        <p className="text-[11px] text-ink-soft">
                          {c.count} transaction{c.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Money value={c.total} size="sm" className="shrink-0 text-ink" />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No spending yet"
                  description="Your most used categories will show up here."
                  className="border-0 bg-transparent py-6"
                />
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
