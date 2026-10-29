"use client";

/**
 * RAQAMORA Reports — full analytical report over a Karachi-calendar date
 * range: summary band, flow / net-position / savings charts, category and
 * account tables, largest expenses and repayment history. Includes CSV export
 * and a print-friendly layout ("Print / Save as PDF").
 */
import * as React from "react";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Download,
  HandCoins,
  PiggyBank,
  Printer,
  Receipt,
  Scale,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/raqamora/money";
import type { PeriodSummary, TxnRow } from "@/lib/raqamora/types";
import { ApiError, apiGet } from "@/lib/raqamora/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
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
const DAY_FULL_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: KARACHI_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: KARACHI_TZ, month: "short", year: "2-digit" });

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const SCROLLBAR =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline [&::-webkit-scrollbar-track]:bg-transparent";

/** Print-friendly tweaks: strip app chrome, keep card headers readable. */
const PRINT_CSS = `
@media print {
  aside, footer, nav { display: none !important; }
  main > div { padding: 0 !important; max-width: none !important; }
  header.sticky { position: static !important; border: 0 !important; background: transparent !important; }
  * { box-shadow: none !important; }
  body { background: #ffffff !important; }
}`;

interface ReportsResponse {
  summary: PeriodSummary;
  daily: Array<{ date: string; income: number; expense: number }>;
  weekly: Array<{ week: string; income: number; expense: number }>;
  monthly: Array<{ month: string; income: number; expense: number }>;
  byCategory: Array<{ name: string; kind: string; total: number; count: number }>;
  byAccount: Array<{ name: string; inflow: number; outflow: number }>;
  repaymentHistory: TxnRow[];
  largest: TxnRow[];
  netPositionTrend: Array<{ month: string; netPosition: number }>;
}

const PRESETS: Array<{ key: string; label: string; range: (today: string) => { from: string; to: string } }> = [
  { key: "this-month", label: "This month", range: (t) => ({ from: monthStart(t), to: t }) },
  {
    key: "last-month",
    label: "Last month",
    range: (t) => {
      const last = shiftDays(monthStart(t), -1);
      return { from: monthStart(last), to: last };
    },
  },
  { key: "last-90", label: "Last 90 days", range: (t) => ({ from: shiftDays(t, -89), to: t }) },
  { key: "this-year", label: "This year", range: (t) => ({ from: `${t.slice(0, 4)}-01-01`, to: t }) },
];

/* ----------------------------------------------------------------- helpers */

/** Karachi (UTC+5) calendar date as YYYY-MM-DD. */
function karachiToday(): string {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
}

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Shift a YYYY-MM-DD day key by N days (UTC-safe, no DST in Karachi). */
function shiftDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function fmtDayFull(value: string): string {
  const d = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return DAY_FULL_FMT.format(d);
}

function fmtMonthKey(key: string): string {
  return MONTH_FMT.format(new Date(`${key}-15T12:00:00Z`));
}

function tickLabel(value: string): string {
  if (typeof value !== "string") return String(value);
  if (value.length === 7) return fmtMonthKey(value);
  if (value.length === 10) return fmtDayFull(value).replace(/ \d{4}$/, "");
  return value;
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

function SortButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide transition-colors",
        active ? "text-ink" : "text-ink-soft hover:text-ink",
      )}
    >
      {label}
      {active ? <ArrowDown className="size-3" aria-hidden /> : null}
    </button>
  );
}

/* ---------------------------------------------------------------- skeleton */

function ReportsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-16 rounded-xl border border-hairline bg-card p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-hairline bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-24" />
          </div>
        ))}
      </div>
      <SkeletonList rows={3} />
    </div>
  );
}

/* -------------------------------------------------------------------- view */

export default function ReportsView({ onViewChange }: ViewProps) {
  const { handleUnauthorized } = useApp();
  const onUnauthorizedRef = React.useRef(handleUnauthorized);
  React.useEffect(() => {
    onUnauthorizedRef.current = handleUnauthorized;
  }, [handleUnauthorized]);

  const [from, setFrom] = React.useState(() => monthStart(karachiToday()));
  const [to, setTo] = React.useState(() => karachiToday());
  const [reports, setReports] = React.useState<ReportsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [catSort, setCatSort] = React.useState<"total" | "count">("total");

  const dataRef = React.useRef<ReportsResponse | null>(null);

  const rangeValid = from !== "" && to !== "" && from <= to;

  const query = React.useMemo(() => {
    if (!rangeValid) return null;
    const sp = new URLSearchParams({
      from: `${from}T00:00:00+05:00`,
      to: `${to}T23:59:59.999+05:00`,
    });
    return sp.toString();
  }, [from, to, rangeValid]);

  const load = React.useCallback(
    async (background = false) => {
      if (!query) return;
      setLoading(true);
      setError(null);
      try {
        const payload = await apiGet<ReportsResponse>(`/api/reports?${query}`);
        dataRef.current = payload;
        setReports(payload);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorizedRef.current();
          return;
        }
        const msg = err instanceof Error ? err.message : "Something went wrong while loading the report.";
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
  }, [load]);

  React.useEffect(() => {
    const handler = () => void load(true);
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, [load]);

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const r = preset.range(karachiToday());
    setFrom(r.from);
    setTo(r.to);
  }

  function exportCsv() {
    if (!query) {
      toast.error("Fix the date range before exporting.");
      return;
    }
    window.location.href = `/api/export/transactions?${query}`;
  }

  const activePreset = PRESETS.find((p) => {
    const r = p.range(karachiToday());
    return r.from === from && r.to === to;
  });

  const catRows = React.useMemo(() => {
    if (!reports) return [];
    const grand = { INCOME: 0, EXPENSE: 0 };
    for (const c of reports.byCategory) {
      if (c.kind === "INCOME") grand.INCOME += c.total;
      else grand.EXPENSE += c.total;
    }
    return [...reports.byCategory]
      .sort((a, b) => b[catSort] - a[catSort] || b.total - a.total)
      .map((c) => ({
        ...c,
        share:
          c.kind === "INCOME"
            ? grand.INCOME > 0
              ? c.total / grand.INCOME
              : 0
            : grand.EXPENSE > 0
              ? c.total / grand.EXPENSE
              : 0,
      }));
  }, [reports, catSort]);

  if (loading && !reports) {
    return (
      <div className="space-y-4">
        <PageHeader title="Reports" description="Insights & CSV export" />
        <ReportsSkeleton />
      </div>
    );
  }

  if (error && !reports) {
    return (
      <div className="space-y-4">
        <PageHeader title="Reports" description="Insights & CSV export" />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load the report"
          description={error}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      </div>
    );
  }

  if (!reports) return null;

  const s = reports.summary;

  const dailyTooLong = reports.daily.length > 92;
  const flowSeries = dailyTooLong
    ? reports.monthly.map((m) => ({ date: m.month, income: m.income, expense: m.expense }))
    : reports.daily;
  const flowHasData = flowSeries.some((p) => p.income > 0 || p.expense > 0);

  const monthlyHasData = reports.monthly.some((m) => m.income > 0 || m.expense > 0);
  const savingsSeries = reports.monthly.map((m) => ({ month: m.month, net: m.income - m.expense }));
  const savingsHasData = savingsSeries.some((p) => p.net !== 0);
  const positionHasData = reports.netPositionTrend.some((p) => p.netPosition !== 0);

  const rangeLabel = `${fmtDayFull(from)} – ${fmtDayFull(to)}`;

  const summaryCards: Array<{ label: string; icon: LucideIcon; value: number; sub?: string }> = [
    { label: "Income", icon: Banknote, value: s.income },
    {
      label: "Net expenses",
      icon: Receipt,
      value: s.netExpense,
      sub: s.refunds > 0 ? `${formatPKR(s.refunds)} refunded` : undefined,
    },
    { label: "Net savings", icon: PiggyBank, value: s.netSavings, sub: "Income minus net expenses" },
    { label: "Lent", icon: HandCoins, value: s.lent, sub: "Given to people" },
    { label: "Borrowed", icon: CreditCard, value: s.borrowed, sub: "Taken from people" },
    { label: "Repayments received", icon: ArrowDownLeft, value: s.repaidReceived, sub: "Back from people" },
    { label: "Repayments made", icon: ArrowUpRight, value: s.repaidMade, sub: "Paid to people" },
    { label: "Transfers", icon: ArrowLeftRight, value: s.transfers, sub: "Between your accounts" },
  ];

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>

      <PageHeader
        title="Reports"
        description={`Insights for ${rangeLabel}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="min-h-9 print:hidden" onClick={exportCsv}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 print:hidden"
              onClick={() => window.print()}
            >
              <Printer className="size-4" aria-hidden />
              Print / Save as PDF
            </Button>
          </>
        }
      />

      <div className="hidden print:block">
        <p className="text-lg font-semibold text-ink">RAQAMORA — Report</p>
        <p className="text-xs text-ink-soft">
          {rangeLabel} · All figures in PKR (paisa-exact), Asia/Karachi calendar
        </p>
      </div>

      {/* ----------------------------------------------------- range filters */}
      <div className="rounded-xl border border-hairline bg-card p-4 shadow-card print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rq-rep-from">From</Label>
            <Input
              id="rq-rep-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rq-rep-to">To</Label>
            <Input
              id="rq-rep-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick presets">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={activePreset?.key === p.key ? "secondary" : "outline"}
                size="sm"
                className="min-h-9"
                aria-pressed={activePreset?.key === p.key}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        {rangeValid ? (
          <p className="mt-2.5 text-[11px] text-ink-soft">
            Dates and totals follow the Asia/Karachi (PKT) calendar — no daylight saving.
          </p>
        ) : (
          <p className="mt-2.5 text-xs font-medium text-warn-brand">
            The end date must be on or after the start date.
          </p>
        )}
      </div>

      {/* ------------------------------------------------------ summary band */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {summaryCards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} sub={c.sub} />
        ))}
      </div>

      {/* ----------------------------------------------------------- charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard
          title={dailyTooLong ? "Flow by Month" : "Daily Flow"}
          subtitle={dailyTooLong ? "Aggregated for long ranges" : "Income and spending day by day"}
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
              title="No activity in this range"
              description="Income and expenses appear here once recorded."
              className="border-0 bg-transparent py-8"
            />
          )}
        </SectionCard>

        <SectionCard title="Monthly Income vs Expenses" subtitle="Calendar months in range">
          {monthlyHasData ? (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={reports.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                  <Tooltip content={<MoneyTip />} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
                  <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expense" name="Expense" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={22} />
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
              title="No income or expenses in this range"
              className="border-0 bg-transparent py-8"
            />
          )}
        </SectionCard>

        <SectionCard title="Net Position Trend" subtitle="Approximate month-end position">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={reports.netPositionTrend} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rq-np-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="netPosition"
                name="Net position"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#rq-np-fill)"
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {!positionHasData ? (
            <p className="mt-2 text-center text-[11px] text-ink-soft">
              Flat at zero — balances and outstanding debts net out to nothing in this range.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Savings Trend" subtitle="Net savings per month (income − expenses)">
          {savingsHasData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={savingsSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                <Tooltip content={<MoneyTip />} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
                <Bar dataKey="net" name="Net savings" radius={[3, 3, 0, 0]} maxBarSize={22}>
                  {savingsSeries.map((p, i) => (
                    <Cell key={i} fill={p.net >= 0 ? "var(--chart-1)" : "var(--chart-5)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={PiggyBank}
              title="No savings movement in this range"
              className="border-0 bg-transparent py-8"
            />
          )}
        </SectionCard>
      </div>

      {/* ----------------------------------------------------------- tables */}
      <SectionCard title="Category Comparison" subtitle="Income and spending grouped by category">
        {catRows.length > 0 ? (
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Category</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">
                  <SortButton active={catSort === "count"} onClick={() => setCatSort("count")} label="Count" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton active={catSort === "total"} onClick={() => setCatSort("total")} label="Total" />
                </TableHead>
                <TableHead className="w-[24%]">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catRows.map((c) => (
                <TableRow key={`${c.kind}-${c.name}`}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <AppIcon name={c.kind === "INCOME" ? "briefcase" : "tag"} className="size-3.5 shrink-0 text-ink-soft" />
                      <span className="truncate">{c.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={c.kind} />
                  </TableCell>
                  <TableCell className="money text-right text-ink-soft">{c.count}</TableCell>
                  <TableCell className="text-right">
                    <Money value={c.total} size="sm" className={c.kind === "INCOME" ? "text-money-pos" : "text-ink"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            c.kind === "INCOME" ? "bg-brand-emerald/70" : "bg-danger-brand/60",
                          )}
                          style={{ width: `${Math.round(c.share * 100)}%` }}
                        />
                      </div>
                      <span className="money w-9 shrink-0 text-[11px] text-ink-soft">
                        {Math.round(c.share * 100)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Receipt}
            title="No category activity in this range"
            description="Categorised income and expenses will be compared here."
            className="border-0 bg-transparent py-6"
          />
        )}
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Account-wise Movement" subtitle="Inflows, outflows and net change">
          {reports.byAccount.length > 0 ? (
            <Table className="min-w-[440px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Inflow</TableHead>
                  <TableHead className="text-right">Outflow</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.byAccount.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="text-[13px] font-medium text-ink">{a.name}</TableCell>
                    <TableCell className="text-right">
                      <Money value={a.inflow} size="sm" className={a.inflow > 0 ? "text-money-pos" : undefined} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={a.outflow} size="sm" className={a.outflow > 0 ? "text-money-neg" : undefined} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={a.inflow - a.outflow} size="sm" colored />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Scale}
              title="No account movement in this range"
              className="border-0 bg-transparent py-6"
            />
          )}
        </SectionCard>

        <SectionCard title="Largest Expenses" subtitle="Top 5 by amount in range">
          {reports.largest.length > 0 ? (
            <Table className="min-w-[440px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.largest.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-ink-soft">{fmtDayFull(t.date)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                        <AppIcon name={t.categoryIcon} className="size-3.5 shrink-0 text-ink-soft" />
                        <span className="truncate">
                          {t.categoryName ?? t.personName ?? t.note ?? "Expense"}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={t.amount} size="sm" className="text-danger-brand" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Receipt}
              title="No expenses in this range"
              className="border-0 bg-transparent py-6"
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Repayment History"
        subtitle="Repayments you received or made in the period"
        action={
          reports.repaymentHistory.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => onViewChange("people")}>
              People
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          ) : undefined
        }
        contentClassName={reports.repaymentHistory.length > 0 ? "p-0 sm:p-0" : undefined}
      >
        {reports.repaymentHistory.length > 0 ? (
          <div className={cn("max-h-72 divide-y divide-hairline overflow-y-auto", SCROLLBAR)}>
            {reports.repaymentHistory.map((t) => {
              const received = t.type === "REPAYMENT_RECEIVED";
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <TypeBadge type={t.type} className="hidden shrink-0 sm:inline-flex" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{t.personName ?? "Unknown person"}</p>
                    <p className="truncate text-[11px] text-ink-soft">
                      {[t.accountName, fmtDayFull(t.date), t.note].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Money value={received ? t.amount : -t.amount} colored size="sm" className="shrink-0" />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={HandCoins}
            title="No repayments in this range"
            description="Repayments you receive or make will be listed here."
            className="border-0 bg-transparent py-6"
          />
        )}
      </SectionCard>
    </div>
  );
}
