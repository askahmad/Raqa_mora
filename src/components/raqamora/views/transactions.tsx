"use client";

/**
 * RAQAMORA Transactions view — server-paginated ledger with rich filters,
 * CSV export, a details drill-down, safe editing (only what the API allows)
 * and debt-aware deletion. Desktop shows a compact table; mobile shows
 * tappable stacked rows.
 */
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Download,
  FilterX,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend, qs } from "@/lib/raqamora/client";
import { formatPKR } from "@/lib/raqamora/money";
import { TXN_TYPES, TXN_TYPE_LABELS, type TxnType } from "@/lib/raqamora/finance";
import type {
  AccountWithBalance,
  CategoryRow,
  PersonRow,
  TxnRow,
} from "@/lib/raqamora/types";
import { AppIcon } from "@/components/raqamora/icon";
import {
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SectionCard,
  SkeletonList,
  Spinner,
  TypeBadge,
} from "@/components/raqamora/kit";
import type { ViewProps } from "@/components/raqamora/view-props";
import TransactionQuickAdd, {
  Field,
  karachiDateTimeIso,
  toLocalInputValue,
  useUnauthorizedGuard,
} from "@/components/raqamora/views/transaction-quick-add";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/* ---------------------------------------------------------------- helpers */

const PAGE_SIZE = 25;
const ALL = "__all";

const POSITIVE_TYPES = new Set(["INCOME", "REFUND", "REPAYMENT_RECEIVED", "BORROWED"]);

/** How a row's amount reads on the page: sign, color and tone by type. */
function amountView(t: TxnRow): { text: string; className: string } {
  if (t.type === "TRANSFER") return { text: `−${formatPKR(t.amount)}`, className: "text-ink-soft" };
  if (t.type === "ADJUSTMENT") {
    return t.signed >= 0
      ? { text: `+${formatPKR(t.amount)}`, className: "text-money-pos" }
      : { text: `−${formatPKR(t.amount)}`, className: "text-money-neg" };
  }
  if (POSITIVE_TYPES.has(t.type)) return { text: `+${formatPKR(t.amount)}`, className: "text-money-pos" };
  return { text: `−${formatPKR(t.amount)}`, className: "text-money-neg" };
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function fmtDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

function fmtTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

function typeLabel(t: TxnRow): string {
  return TXN_TYPE_LABELS[t.type as TxnType] ?? String(t.type);
}

function rowTitle(t: TxnRow): string {
  return t.note ?? t.categoryName ?? typeLabel(t);
}

interface Filters {
  q: string;
  type: string;
  categoryId: string;
  accountId: string;
  personId: string;
  from: string;
  to: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = {
  q: "",
  type: "",
  categoryId: "",
  accountId: "",
  personId: "",
  from: "",
  to: "",
  sort: "date_desc",
};

/** Expand date-only inputs into full Karachi-day boundaries for the API. */
function listQuery(filters: Filters, page: number): string {
  return qs({
    q: filters.q || undefined,
    type: filters.type || undefined,
    categoryId: filters.categoryId || undefined,
    accountId: filters.accountId || undefined,
    personId: filters.personId || undefined,
    from: filters.from ? `${filters.from}T00:00:00+05:00` : undefined,
    to: filters.to ? `${filters.to}T23:59:59+05:00` : undefined,
    page,
    pageSize: PAGE_SIZE,
    sort: filters.sort,
  });
}

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Amount: high → low" },
  { value: "amount_asc", label: "Amount: low → high" },
];

/* -------------------------------------------------------------- main view */

export default function TransactionsView({ onViewChange }: ViewProps) {
  const guard = useUnauthorizedGuard();

  /* ---- reference data for filters + edit dialog ---- */
  const [base, setBase] = React.useState<{
    accounts: AccountWithBalance[];
    categories: CategoryRow[];
    people: PersonRow[];
  }>({ accounts: [], categories: [], people: [] });

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts"),
      apiGet<{ categories: CategoryRow[] }>("/api/categories"),
      apiGet<{ people: PersonRow[] }>("/api/people"),
    ])
      .then(([a, c, p]) => {
        if (alive) setBase({ accounts: a.accounts, categories: c.categories, people: p.people });
      })
      .catch((err) => {
        guard(err);
      });
    return () => {
      alive = false;
    };
  }, [guard]);

  /* ---- list state ---- */
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [qInput, setQInput] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [txns, setTxns] = React.useState<TxnRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  /* debounced search */
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const next = qInput.trim();
      setFilters((f) => (f.q === next ? f : { ...f, q: next }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [qInput]);

  /* server-paginated fetch */
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiGet<{ txns: TxnRow[]; total: number; page: number; pageSize: number }>(
      `/api/transactions${listQuery(filters, page)}`,
    )
      .then((res) => {
        if (!alive) return;
        setTxns(res.txns);
        setTotal(res.total);
        const maxPage = Math.max(1, Math.ceil(res.total / PAGE_SIZE));
        if (res.total === 0 && page > 1) setPage(1);
        else if (page > maxPage) setPage(maxPage);
      })
      .catch((err) => {
        if (!alive) return;
        if (guard(err)) return;
        setError(err instanceof Error ? err.message : "Could not load transactions");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters, page, reloadToken, guard]);

  /* other views mutate transactions → refetch */
  React.useEffect(() => {
    const handler = () => setReloadToken((t) => t + 1);
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, []);

  function update(partial: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...partial }));
    setPage(1);
  }

  const hasActiveFilters = Boolean(
    filters.q || filters.type || filters.categoryId || filters.accountId || filters.personId || filters.from || filters.to,
  );

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    setQInput("");
    setPage(1);
  }

  function exportCsv() {
    const query = qs({
      q: filters.q || undefined,
      type: filters.type || undefined,
      categoryId: filters.categoryId || undefined,
      accountId: filters.accountId || undefined,
      personId: filters.personId || undefined,
      from: filters.from ? `${filters.from}T00:00:00+05:00` : undefined,
      to: filters.to ? `${filters.to}T23:59:59+05:00` : undefined,
    });
    const a = document.createElement("a");
    a.href = `/api/export/transactions${query}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---- dialogs ---- */
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<TxnRow | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const activeFilterCount = [
    filters.type,
    filters.categoryId,
    filters.accountId,
    filters.personId,
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  async function doDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      await apiSend(`/api/transactions/${selected.id}`, "DELETE");
      toast.success("Transaction deleted");
      setConfirmDelete(false);
      setSelected(null);
      window.dispatchEvent(new Event("raqamora:txn-changed"));
    } catch (err) {
      setConfirmDelete(false);
      if (guard(err)) return;
      const isLinkedDebt = err instanceof ApiError && err.status === 400;
      toast.error(err instanceof Error ? err.message : "Could not delete the transaction", {
        description: isLinkedDebt
          ? "This record belongs to a ledger entry. Open the Debts page and delete the debt there instead."
          : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const selectedIsDebtLinked = Boolean(selected?.debtId);

  const expenseCategories = base.categories.filter((c) => c.kind === "EXPENSE");
  const incomeCategories = base.categories.filter((c) => c.kind === "INCOME");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        description="Every rupee in and out"
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} className="min-h-9">
              <Download className="size-4" aria-hidden /> Export CSV
            </Button>
            <Button onClick={() => setQuickAddOpen(true)}>
              <Plus className="size-4" aria-hidden /> Add transaction
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------- filter bar */}
      <SectionCard contentClassName="p-3 sm:p-4">
        {/* Search & Mobile Filter Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
              aria-hidden
            />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search notes & reasons…"
              aria-label="Search transactions"
              className="min-h-11 rounded-xl pl-9 bg-muted/30 border-hairline/80"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setMobileFiltersOpen((o) => !o)}
            className={cn(
              "md:hidden min-h-11 rounded-xl gap-1.5 px-3 border-hairline/80 font-medium",
              activeFilterCount > 0 && "border-brand-emerald text-brand-emerald font-semibold bg-brand-emerald/10",
            )}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-brand-emerald text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>

          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              title="Clear filters"
              aria-label="Clear filters"
              className="md:hidden min-h-11 size-11 rounded-xl text-ink-soft hover:text-ink shrink-0"
            >
              <FilterX className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>

        {/* Detailed Filters (Collapsible on mobile, always visible on desktop) */}
        <div
          className={cn(
            "grid-cols-2 gap-2 pt-3 sm:grid-cols-12",
            mobileFiltersOpen ? "grid" : "hidden md:grid",
          )}
        >
          <Select value={filters.type || ALL} onValueChange={(v) => update({ type: v === ALL ? "" : v })}>
            <SelectTrigger className="min-h-11 rounded-xl sm:col-span-3" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={ALL}>All types</SelectItem>
              {TXN_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TXN_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.sort} onValueChange={(v) => update({ sort: v })}>
            <SelectTrigger className="min-h-11 rounded-xl sm:col-span-3" aria-label="Sort transactions">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.categoryId || ALL}
            onValueChange={(v) => update({ categoryId: v === ALL ? "" : v })}
          >
            <SelectTrigger className="min-h-11 rounded-xl sm:col-span-2" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64 rounded-xl">
              <SelectItem value={ALL}>All categories</SelectItem>
              <SelectGroup>
                <SelectLabel>Expense</SelectLabel>
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Income</SelectLabel>
                {incomeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={filters.accountId || ALL}
            onValueChange={(v) => update({ accountId: v === ALL ? "" : v })}
          >
            <SelectTrigger className="min-h-11 rounded-xl sm:col-span-2" aria-label="Filter by account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64 rounded-xl">
              <SelectItem value={ALL}>All accounts</SelectItem>
              {base.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {a.archived ? " · archived" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.personId || ALL}
            onValueChange={(v) => update({ personId: v === ALL ? "" : v })}
          >
            <SelectTrigger className="min-h-11 rounded-xl sm:col-span-2" aria-label="Filter by person">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64 rounded-xl">
              <SelectItem value={ALL}>All people</SelectItem>
              {base.people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
            aria-label="From date"
            className="min-h-11 rounded-xl sm:col-span-2"
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
            aria-label="To date"
            className="min-h-11 rounded-xl sm:col-span-2"
          />

          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="col-span-2 hidden md:inline-flex min-h-11 rounded-xl gap-1.5 text-ink-soft hover:text-ink sm:col-span-2"
          >
            <FilterX className="size-4" aria-hidden /> Clear filters
          </Button>
        </div>
      </SectionCard>

      {/* ------------------------------------------------------- list */}
      {loading && txns.length === 0 && !error ? (
        <SkeletonList rows={6} />
      ) : error ? (
        <EmptyState
          title="Couldn't load transactions"
          description={error}
          actionLabel="Retry"
          onAction={() => setReloadToken((t) => t + 1)}
        />
      ) : total === 0 && !hasActiveFilters ? (
        <EmptyState
          icon={Plus}
          title="Start with your first transaction"
          description="Log income, expenses, transfers or person-wise ledger entries — it takes seconds."
          actionLabel="Add transaction"
          onAction={() => setQuickAddOpen(true)}
        />
      ) : total === 0 && hasActiveFilters ? (
        <EmptyState
          icon={Search}
          title="Try different filters"
          description="No transactions match the current filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <>
          {/* desktop table */}
          <div
            className={cn(
              "hidden overflow-hidden rounded-xl border border-hairline bg-card shadow-card md:block",
              loading && "pointer-events-none opacity-60",
            )}
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[130px] pl-4 text-[11px] uppercase tracking-wide text-ink-soft">
                    Date
                  </TableHead>
                  <TableHead className="w-[130px] text-[11px] uppercase tracking-wide text-ink-soft">
                    Type
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-ink-soft">
                    Description
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-ink-soft">
                    Account
                  </TableHead>
                  <TableHead className="pr-4 text-right text-[11px] uppercase tracking-wide text-ink-soft">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.map((t) => {
                  const a = amountView(t);
                  return (
                    <TableRow
                      key={t.id}
                      tabIndex={0}
                      aria-label={`${typeLabel(t)}: ${rowTitle(t)}, ${a.text}`}
                      onClick={() => setSelected(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(t);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell className="pl-4">
                        <span className="block text-[13px] font-medium text-ink">{fmtDay(t.date)}</span>
                        <span className="block text-[11px] text-ink-soft">{fmtTime(t.date)}</span>
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={t.type} />
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft"
                            aria-hidden
                          >
                            <AppIcon name={t.categoryIcon} className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-medium text-ink">
                              {rowTitle(t)}
                              {t.offlinePending ? (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                                  ⏳ Offline
                                </span>
                              ) : null}
                            </span>
                            {t.personName ? (
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-ink-soft">
                                <User className="size-2.5" aria-hidden />
                                {t.personName}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-[13px] text-ink-soft">
                        {t.type === "TRANSFER"
                          ? `${t.accountName ?? "—"} → ${t.toAccountName ?? "—"}`
                          : (t.accountName ?? "—")}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <span className={cn("money text-[14px] font-semibold", a.className)}>
                          {a.text}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* mobile stacked rows */}
          <div
            className={cn("grid gap-2.5 md:hidden", loading && "pointer-events-none opacity-60")}
            aria-label="Transactions"
          >
            {txns.map((t) => {
              const a = amountView(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-hairline/80 bg-card p-3.5 text-left shadow-card transition-all duration-150 active:scale-[0.98] active:bg-muted/40 hover:border-brand-emerald/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink-soft shadow-2xs"
                    aria-hidden
                  >
                    <AppIcon name={t.categoryIcon} className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {rowTitle(t)}
                      {t.offlinePending ? (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                          ⏳ Offline
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-soft">
                      <TypeBadge type={t.type} className="shrink-0 px-1.5 py-0 text-[9px] rounded-md" />
                      <span className="truncate">
                        {fmtDay(t.date)}
                        {t.personName ? ` · ${t.personName}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className={cn("money shrink-0 text-[14.5px] font-bold", a.className)}>
                    {a.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-soft" aria-live="polite">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* --------------------------------------- local quick-add dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Nayi Entry</DialogTitle>
            <DialogDescription>
              Kharcha, aamdani ya khata jaldi se record karein.
            </DialogDescription>
          </DialogHeader>
          <TransactionQuickAdd
            onSaved={() => {
              setQuickAddOpen(false);
              window.dispatchEvent(new Event("raqamora:txn-changed"));
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ details dialog */}
      <Dialog
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Transaction details</DialogTitle>
            <DialogDescription className="sr-only">
              Full details of the selected transaction.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <TypeBadge type={selected.type} />
                <span
                  className={cn("money text-xl font-semibold", amountView(selected).className)}
                >
                  {amountView(selected).text}
                </span>
              </div>

              <dl className="grid gap-x-4 gap-y-2.5 rounded-xl border border-hairline bg-muted/40 p-3.5 sm:grid-cols-[110px_1fr]">
                <DetailRow
                  label="Date"
                  value={`${fmtDay(selected.date)} · ${fmtTime(selected.date)}`}
                />
                <DetailRow label="Type" value={typeLabel(selected)} />
                {selected.accountName ? (
                  <DetailRow
                    label={selected.type === "TRANSFER" ? "From account" : "Account"}
                    value={selected.accountName}
                  />
                ) : null}
                {selected.toAccountName ? (
                  <DetailRow label="To account" value={selected.toAccountName} />
                ) : null}
                {selected.categoryName ? (
                  <DetailRow
                    label="Category"
                    value={selected.categoryName}
                    icon={selected.categoryIcon}
                  />
                ) : null}
                {selected.personName ? <DetailRow label="Person" value={selected.personName} /> : null}
                {selected.note ? <DetailRow label="Note" value={selected.note} /> : null}
                {selected.reason ? <DetailRow label="Reason" value={selected.reason} /> : null}
              </dl>

              {selectedIsDebtLinked ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-warn-brand/30 bg-warn-brand/10 px-3 py-2.5">
                  <p className="text-[12px] leading-snug text-ink">
                    Linked to a ledger entry — manage it from the Debts page.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-8 shrink-0"
                    onClick={() => {
                      setSelected(null);
                      onViewChange("debts");
                    }}
                  >
                    Open Debts
                  </Button>
                </div>
              ) : null}

              <DialogFooter className="gap-2 sm:gap-2">
                {!selectedIsDebtLinked ? (
                  <Button variant="outline" className="min-h-10" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" aria-hidden /> Edit
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="min-h-10 text-danger-brand hover:bg-danger-brand/10 hover:text-danger-brand"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" aria-hidden /> Delete
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------- edit dialog */}
      {selected ? (
        <TxnEditDialog
          key={selected.id}
          txn={selected}
          categories={base.categories}
          people={base.people}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSelected(null);
            toast.success("Transaction updated");
            window.dispatchEvent(new Event("raqamora:txn-changed"));
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(false);
        }}
        title={selected ? `Delete this ${typeLabel(selected).toLowerCase()}?` : "Delete transaction?"}
        description={
          selected?.debtId
            ? "This record is linked to a ledger entry. Deleting the debt itself is done from the Debts page."
            : "This permanently removes the transaction. This cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  );
}

/* --------------------------------------------------------- detail row bit */

function DetailRow({ label, value, icon }: { label: string; value: string; icon?: string | null }) {
  return (
    <>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-[13px] leading-snug text-ink">
        {icon ? <AppIcon name={icon} className="size-3.5 shrink-0 text-ink-soft" /> : null}
        <span className="break-words">{value}</span>
      </dd>
    </>
  );
}

/* ------------------------------------------------------------ edit dialog */

const editSchema = z.object({
  amountRupees: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  date: z.string().min(1, "Date is required"),
  note: z.string().max(500).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  personId: z.string().optional().nullable(),
});

function TxnEditDialog({
  txn,
  categories,
  people,
  open,
  onClose,
  onSaved,
}: {
  txn: TxnRow;
  categories: CategoryRow[];
  people: PersonRow[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const guard = useUnauthorizedGuard();
  const [saving, setSaving] = React.useState(false);

  // Per the API contract only amount / date / note / category / person are editable.
  const showCategory = txn.categoryId !== null || ["INCOME", "EXPENSE", "REFUND"].includes(txn.type);
  const showPerson = txn.personId !== null || txn.type === "EXPENSE";
  const categoryKind = txn.type === "INCOME" ? "INCOME" : "EXPENSE";

  type EditInput = z.input<typeof editSchema>;
  type EditOutput = z.output<typeof editSchema>;

  const form = useForm<EditInput, unknown, EditOutput>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      amountRupees: txn.amount / 100,
      date: toLocalInputValue(new Date(txn.date)),
      note: txn.note,
      categoryId: txn.categoryId,
      personId: txn.personId,
    },
  });
  const errors = form.formState.errors;
  const watchedCategoryId = form.watch("categoryId");
  const watchedPersonId = form.watch("personId");

  async function submit(values: EditOutput) {
    setSaving(true);
    try {
      await apiSend(`/api/transactions/${txn.id}`, "PATCH", {
        amountRupees: values.amountRupees,
        date: karachiDateTimeIso(values.date),
        note: values.note?.trim() || null,
        ...(showCategory ? { categoryId: values.categoryId ?? null } : {}),
        ...(showPerson ? { personId: values.personId ?? null } : {}),
      });
      onSaved();
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Could not update the transaction");
      }
    } finally {
      setSaving(false);
    }
  }

  const editableCategories = categories.filter((c) => c.kind === categoryKind && !c.archived);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit transaction</DialogTitle>
          <DialogDescription>
            Only the amount, date, note, category and person can be changed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-3.5">
          {/* locked fields shown as text */}
          <div className="grid gap-2 rounded-xl border border-hairline bg-muted/40 p-3 sm:grid-cols-[110px_1fr]">
            <DetailRow label="Type" value={typeLabel(txn)} />
            {txn.accountName ? <DetailRow label="Account" value={txn.accountName} /> : null}
            {txn.toAccountName ? <DetailRow label="To account" value={txn.toAccountName} /> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (Rs)" error={errors.amountRupees?.message}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                className="min-h-11"
                {...form.register("amountRupees", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Date & time" error={errors.date?.message}>
              <Input type="datetime-local" className="min-h-11" {...form.register("date")} />
            </Field>
          </div>

          {showCategory ? (
            <Field label="Category" error={errors.categoryId?.message}>
              <Select
                value={watchedCategoryId ?? ""}
                onValueChange={(v) => form.setValue("categoryId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="Category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {editableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex min-w-0 items-center gap-2">
                        <AppIcon name={c.icon} className="size-3.5 shrink-0 text-ink-soft" />
                        <span className="truncate">{c.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {showPerson ? (
            <Field label="Person" error={errors.personId?.message}>
              <Select
                value={watchedPersonId ?? ""}
                onValueChange={(v) => form.setValue("personId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="Person">
                  <SelectValue placeholder="No one" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="truncate">{p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="Note" htmlFor="raqamora-edit-note">
            <Textarea
              id="raqamora-edit-note"
              rows={2}
              maxLength={500}
              placeholder="Optional note"
              className="resize-none"
              {...form.register("note")}
            />
          </Field>

          <Button type="submit" className="min-h-11 w-full" disabled={saving}>
            {saving ? <Spinner className="size-4 text-current" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
