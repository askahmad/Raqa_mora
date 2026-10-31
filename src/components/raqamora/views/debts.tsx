"use client";

/**
 * RAQAMORA Debts view — receivables & payables across all people. Tabbed by
 * direction ("They owe me" / "I owe" / "Settled") with per-tab summaries,
 * filters, an overdue/due-soon insight strip and full entry actions.
 *
 * Reuses the shared DebtDialog / RepaymentDialog / DebtEditDialog / DebtCard
 * exported from the People view module.
 */
import * as React from "react";
import { AlertTriangle, CheckCircle2, HandCoins, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiGet, apiSend } from "@/lib/raqamora/client";
import { getCachedGet } from "@/lib/raqamora/offline-sync";
import { formatPKR } from "@/lib/raqamora/money";
import type { DebtWithOutstanding, PersonRow } from "@/lib/raqamora/types";
import {
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SkeletonList,
} from "@/components/raqamora/kit";
import type { ViewProps } from "@/components/raqamora/view-props";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DebtCard,
  DebtDialog,
  DebtEditDialog,
  RepaymentDialog,
  SELECTED_PERSON_KEY,
  ToneStatCard,
  debtDueStatus,
  dispatchTxnChanged,
  useApiGuard,
} from "@/components/raqamora/views/people";

/* ------------------------------------------------------------------ consts */

type TabKey = "receivable" | "payable" | "settled";
type StatusFilter = "ALL" | "ACTIVE" | "SETTLED";
type SortKey = "newest" | "due" | "amount";

/* ------------------------------------------------------------------ helpers */

function sortDebts(rows: DebtWithOutstanding[], key: SortKey): DebtWithOutstanding[] {
  const arr = [...rows];
  if (key === "amount") {
    arr.sort((a, b) => b.outstanding - a.outstanding);
  } else if (key === "due") {
    arr.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else {
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return arr;
}

/* --------------------------------------------------------------- the view */

export default function DebtsView({ onViewChange }: ViewProps) {
  const guard = useApiGuard();
  const cachedDebts = getCachedGet<{ debts: DebtWithOutstanding[] }>("/api/debts");
  const cachedPeople = getCachedGet<{ people: PersonRow[] }>("/api/people");
  const [debts, setDebts] = React.useState<DebtWithOutstanding[] | null>(() => cachedDebts?.debts ?? null);
  const [people, setPeople] = React.useState<PersonRow[]>(() => cachedPeople?.people ?? []);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<TabKey>("receivable");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [personFilter, setPersonFilter] = React.useState<string>("ALL");
  const [sortKey, setSortKey] = React.useState<SortKey>("due");

  const [debtDialogOpen, setDebtDialogOpen] = React.useState(false);
  const [repayOpen, setRepayOpen] = React.useState(false);
  const [repayInitialId, setRepayInitialId] = React.useState<string | null>(null);
  const [editDebt, setEditDebt] = React.useState<DebtWithOutstanding | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DebtWithOutstanding | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const { debts: rows } = await apiGet<{ debts: DebtWithOutstanding[] }>("/api/debts");
      setDebts(rows);
      setLoadError(null);
    } catch (err) {
      const msg = guard(err, "Could not load debts");
      if (msg === null) return;
      setLoadError(msg);
    }
    try {
      const { people: rows } = await apiGet<{ people: PersonRow[] }>("/api/people");
      setPeople(rows);
    } catch (err) {
      const msg = guard(err, "Could not load people for the filters");
      if (msg) toast.error(msg, { description: "The person picker may be incomplete — try reloading." });
    }
  }, [guard]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const handler = () => void load();
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, [load]);

  function goPerson(personId: string) {
    window.sessionStorage.setItem(SELECTED_PERSON_KEY, personId);
    onViewChange("people");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/debts/${deleteTarget.id}`, "DELETE");
      toast.success("Ledger entry deleted");
      setDeleteTarget(null);
      dispatchTxnChanged();
      void load();
    } catch (err) {
      setDeleting(false);
      setDeleteTarget(null);
      const msg = guard(err, "Could not delete this entry");
      if (msg) {
        toast.error(msg, {
          description: "Entries with repayments recorded cannot be deleted — remove those repayment transactions first.",
        });
      }
    }
  }

  const all = debts ?? [];
  const openDebts = all.filter((d) => d.status !== "SETTLED");
  const settledDebts = all.filter((d) => d.status === "SETTLED");
  const repayableDebts = openDebts.filter((d) => d.outstanding > 0);

  const tabBase =
    tab === "settled"
      ? settledDebts
      : openDebts.filter((d) => d.direction === (tab === "receivable" ? "RECEIVABLE" : "PAYABLE"));

  const list = sortDebts(
    tabBase
      .filter((d) => personFilter === "ALL" || d.personId === personFilter)
      .filter((d) => (tab === "settled" ? true : statusFilter === "ALL" || d.status === statusFilter)),
    sortKey,
  );

  const openReceivableCount = openDebts.filter((d) => d.direction === "RECEIVABLE").length;
  const openPayableCount = openDebts.filter((d) => d.direction === "PAYABLE").length;

  const summary = (() => {
    if (tab === "settled") {
      const total = list.reduce((s, d) => s + d.principal, 0);
      return {
        label: "Total settled",
        value: total,
        tone: "neutral" as const,
        sub: `${list.length} ${list.length === 1 ? "entry" : "entries"} cleared by repayments`,
      };
    }
    const total = list.reduce((s, d) => s + d.outstanding, 0);
    return tab === "receivable"
      ? {
          label: "Total to receive",
          value: total,
          tone: "pos" as const,
          sub: `${list.length} ${list.length === 1 ? "entry" : "entries"} — money coming in`,
        }
      : {
          label: "Total to pay",
          value: total,
          tone: "neg" as const,
          sub: `${list.length} ${list.length === 1 ? "entry" : "entries"} — money going out`,
        };
  })();

  const overdue = openDebts.filter((d) => debtDueStatus(d.dueDate).key === "overdue");
  const dueSoon = openDebts.filter((d) => debtDueStatus(d.dueDate).key === "soon");
  const overdueTotal = overdue.reduce((s, d) => s + d.outstanding, 0);
  const dueSoonTotal = dueSoon.reduce((s, d) => s + d.outstanding, 0);
  const showInsight = openDebts.length > 0 && (overdue.length > 0 || dueSoon.length > 0);

  const filtersActive = personFilter !== "ALL" || (tab !== "settled" && statusFilter !== "ALL");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Debts"
        description="Every rupee you are owed or owe — who, how much, by when"
        actions={
          <Button
            size="sm"
            className="min-h-9 rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald text-white font-semibold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:brightness-105 active:scale-95 transition-all"
            onClick={() => setDebtDialogOpen(true)}
          >
            <Plus className="size-4 mr-1.5" aria-hidden />
            New ledger entry
          </Button>
        }
      />

      {/* Insight strip */}
      {showInsight ? (
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border p-3.5",
            overdue.length > 0
              ? "border-danger-brand/30 bg-danger-brand/[0.06]"
              : "border-warn-brand/30 bg-warn-brand/[0.07]",
          )}
        >
          <AlertTriangle
            className={cn("size-4 shrink-0", overdue.length > 0 ? "text-danger-brand" : "text-warn-brand")}
            aria-hidden
          />
          {overdue.length > 0 ? (
            <span className="text-sm font-medium text-danger-brand">
              {overdue.length} {overdue.length === 1 ? "payment" : "payments"} overdue —{" "}
              <span className="money">{formatPKR(overdueTotal)}</span>
            </span>
          ) : (
            <span className="text-sm font-medium text-[#7c5d1d] dark:text-[#d9b25f]">Nothing overdue — on schedule</span>
          )}
          {dueSoon.length > 0 ? (
            <span className="text-xs text-ink-soft">
              {dueSoon.length} {dueSoon.length === 1 ? "entry" : "entries"} due within 7 days —{" "}
              <span className="money">{formatPKR(dueSoonTotal)}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full flex-wrap sm:w-auto">
          <TabsTrigger value="receivable" className="gap-1.5">
            They owe me
            <span className="money rounded-full bg-muted px-1.5 text-[10px] leading-4 text-ink-soft">
              {openReceivableCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="payable" className="gap-1.5">
            I owe
            <span className="money rounded-full bg-muted px-1.5 text-[10px] leading-4 text-ink-soft">
              {openPayableCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="settled">Settled</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger
            size="sm"
            aria-label="Filter by status"
            className="w-[132px] bg-card"
            disabled={tab === "settled"}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SETTLED">Settled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={personFilter} onValueChange={setPersonFilter}>
          <SelectTrigger aria-label="Filter by person" className="w-[150px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All people</SelectItem>
            {[...people]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger aria-label="Sort entries" className="w-[150px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Sort: due date</SelectItem>
            <SelectItem value="amount">Sort: amount</SelectItem>
            <SelectItem value="newest">Sort: newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      {loadError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load debts"
          description={loadError}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : debts === null ? (
        <SkeletonList rows={4} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No ledger entries yet"
          description="Record money you lent or borrowed — RAQAMORA tracks balances per person like a digital khata."
          actionLabel="New ledger entry"
          onAction={() => setDebtDialogOpen(true)}
        />
      ) : (
        <>
          <ToneStatCard label={summary.label} value={summary.value} tone={summary.tone} sub={summary.sub} />
          {list.length === 0 ? (
            filtersActive ? (
              <EmptyState
                title="No entries match these filters"
                description="Try a different person, status or tab."
              />
            ) : tab === "receivable" ? (
              <EmptyState
                icon={HandCoins}
                title="No one owes you anything"
                description="Or add an entry above — lending with a due date keeps reminders flowing."
                actionLabel="New ledger entry"
                onAction={() => setDebtDialogOpen(true)}
              />
            ) : tab === "payable" ? (
              <EmptyState
                icon={HandCoins}
                title="You do not owe anyone"
                description="Record money you borrow so it never slips your mind."
                actionLabel="New ledger entry"
                onAction={() => setDebtDialogOpen(true)}
              />
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing settled yet"
                description="Entries move here automatically once repayments clear them."
              />
            )
          ) : (
            <div className="space-y-3">
              {list.map((d) => (
                <DebtCard
                  key={d.id}
                  debt={d}
                  onOpenPerson={() => goPerson(d.personId)}
                  onRepay={() => {
                    setRepayInitialId(d.id);
                    setRepayOpen(true);
                  }}
                  onEdit={() => setEditDebt(d)}
                  onDelete={() => setDeleteTarget(d)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <DebtDialog
        open={debtDialogOpen}
        onOpenChange={setDebtDialogOpen}
        people={people}
        onSaved={() => void load()}
      />
      <RepaymentDialog
        open={repayOpen}
        onOpenChange={setRepayOpen}
        debts={repayableDebts}
        initialDebtId={repayInitialId}
        onSaved={() => void load()}
      />
      <DebtEditDialog
        open={editDebt !== null}
        onOpenChange={(o) => !o && setEditDebt(null)}
        debt={editDebt}
        onSaved={() => void load()}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this ledger entry?"
        description={
          deleteTarget
            ? `${formatPKR(deleteTarget.principal)} ${deleteTarget.direction === "RECEIVABLE" ? "lent to" : "borrowed from"} ${deleteTarget.personName} will be removed along with its original transaction.`
            : undefined
        }
        confirmLabel="Delete entry"
        destructive
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
