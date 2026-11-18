"use client";

/**
 * RAQAMORA Accounts view — wallets with live balances. Includes create/edit
 * (rename/recolor/re-icon), per-account history drill-down, balance
 * reconciliation via ADJUSTMENT transactions, archive/unarchive and a
 * transaction-guarded delete. Transfers reuse the quick-add form.
 */
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  Calendar,
  CalendarRange,
  Check,
  ChevronDown,
  Ellipsis,
  History,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend, qs } from "@/lib/raqamora/client";
import { getCachedGet } from "@/lib/raqamora/offline-sync";
import { formatPKR, parseRupeesToPaisa } from "@/lib/raqamora/money";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  TXN_TYPE_LABELS,
  type AccountType,
  type TxnType,
} from "@/lib/raqamora/finance";
import { accountSchema } from "@/lib/raqamora/validation";
import type {
  AccountMonthlyRecord,
  AccountMonthlyResponse,
  AccountWithBalance,
  CategoryRow,
  TxnRow,
} from "@/lib/raqamora/types";
import { AccountIcon, AppIcon, ICON_CHOICES } from "@/components/raqamora/icon";
import {
  ConfirmDialog,
  EmptyState,
  Money,
  PageHeader,
  SkeletonList,
  Spinner,
} from "@/components/raqamora/kit";
import type { ViewProps } from "@/components/raqamora/view-props";
import TransactionQuickAdd, {
  Field,
  useUnauthorizedGuard,
} from "@/components/raqamora/views/transaction-quick-add";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ---------------------------------------------------------------- helpers */

const PRESET_COLORS = [
  "#16836F", // brand emerald
  "#0D5F4F", // deep emerald
  "#2BA48A", // teal
  "#C5A46D", // champagne gold
  "#B98A2F", // amber
  "#B4453A", // brand danger
  "#101C2C", // midnight navy
  "#78716C", // warm stone
];

const POSITIVE_TYPES = new Set(["INCOME", "REFUND", "REPAYMENT_RECEIVED", "BORROWED"]);

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

function fmtDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

function fmtMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
}

function typeLabel(t: TxnRow): string {
  return TXN_TYPE_LABELS[t.type as TxnType] ?? String(t.type);
}

/* -------------------------------------------------------------- main view */

export default function AccountsView(_props: ViewProps) {
  const guard = useUnauthorizedGuard();

  const cachedAccounts = getCachedGet<{ accounts: AccountWithBalance[] }>("/api/accounts");
  const [accounts, setAccounts] = React.useState<AccountWithBalance[]>(() => cachedAccounts?.accounts ?? []);
  const [loading, setLoading] = React.useState<boolean>(() => !cachedAccounts);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  /* dialog state */
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AccountWithBalance | null>(null);
  const [historyOf, setHistoryOf] = React.useState<AccountWithBalance | null>(null);
  const [adjusting, setAdjusting] = React.useState<AccountWithBalance | null>(null);
  const [quickEditAccount, setQuickEditAccount] = React.useState<AccountWithBalance | null>(null);
  const [monthlyAccount, setMonthlyAccount] = React.useState<AccountWithBalance | null>(null);
  const [addMonthlyFor, setAddMonthlyFor] = React.useState<{ account: AccountWithBalance; month?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<AccountWithBalance | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  /* ---- fetch accounts ---- */
  React.useEffect(() => {
    let alive = true;
    if (accounts.length === 0) setLoading(true);
    setError(null);
    apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts")
      .then(({ accounts: list }) => {
        if (alive) setAccounts(list);
      })
      .catch((err) => {
        if (!alive) return;
        if (guard(err)) return;
        setError(err instanceof Error ? err.message : "Could not load accounts");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadToken, guard]);

  /* transaction/account mutations anywhere → refetch balances */
  React.useEffect(() => {
    const handler = () => setReloadToken((t) => t + 1);
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, []);

  function notifyMutation(message: string) {
    toast.success(message);
    window.dispatchEvent(new Event("raqamora:txn-changed"));
  }

  async function toggleArchive(account: AccountWithBalance) {
    setBusyId(account.id);
    try {
      await apiSend<{ account: AccountWithBalance }>(`/api/accounts/${account.id}`, "PATCH", {
        archived: !account.archived,
      });
      notifyMutation(account.archived ? `${account.name} restored` : `${account.name} archived`);
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Could not update the account");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await apiSend(`/api/accounts/${confirmDelete.id}`, "DELETE");
      notifyMutation(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
    } catch (err) {
      setConfirmDelete(null);
      if (guard(err)) return;
      const apiErr = err instanceof ApiError ? err : null;
      toast.error(apiErr?.message ?? "Could not delete the account", {
        description:
          apiErr?.status === 400
            ? "This account still has transactions. Archive it instead, or move its transactions to another account first."
            : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  const activeAccounts = accounts.filter((a) => !a.archived);
  const archivedAccounts = accounts.filter((a) => a.archived);
  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts"
        description="Cash, bank & mobile wallets"
        actions={
          <>
            <Button variant="outline" onClick={() => setTransferOpen(true)} className="min-h-9 rounded-xl shadow-2xs hover:bg-muted/60 active:scale-95 transition-transform">
              <ArrowLeftRight className="size-4 mr-1.5" aria-hidden /> Transfer
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="min-h-9 rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald text-white font-semibold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:brightness-105 active:scale-95 transition-all"
            >
              <Plus className="size-4 mr-1.5" aria-hidden /> New account
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------ summary strip */}
      <section
        aria-label="Balance summary"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1320] via-[#111c2e] to-[#080d17] p-5 text-ivory shadow-raised border border-white/10 sm:p-6"
      >
        <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-brand-emerald/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 size-36 rounded-full bg-gold/15 blur-2xl" />
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ivory/60">
            Total Consolidated Balance
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <Money value={totalBalance} size="xl" className="text-3xl sm:text-4xl font-extrabold text-white" />
            <p className="pb-1 text-xs text-ivory/70 font-medium">
              Across {activeAccounts.length} active{" "}
              {activeAccounts.length === 1 ? "account" : "accounts"}
              {archivedAccounts.length > 0 ? ` · ${archivedAccounts.length} archived` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- cards grid */}
      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <EmptyState
          title="Couldn't load accounts"
          description={error}
          actionLabel="Retry"
          onAction={() => setReloadToken((t) => t + 1)}
        />
      ) : activeAccounts.length === 0 && archivedAccounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Create your first wallet — cash in hand, a bank account or Easypaisa — to start tracking every rupee."
          actionLabel="New account"
          onAction={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : activeAccounts.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="All accounts are archived"
          description="Restore an archived account below, or create a new one."
          actionLabel="New account"
          onAction={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeAccounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              busy={busyId === a.id}
              onViewHistory={() => setHistoryOf(a)}
              onEdit={() => {
                setEditing(a);
                setFormOpen(true);
              }}
              onAdjust={() => setAdjusting(a)}
              onQuickEdit={() => setQuickEditAccount(a)}
              onMonthlyProgress={() => setMonthlyAccount(a)}
              onToggleArchive={() => void toggleArchive(a)}
              onDelete={() => setConfirmDelete(a)}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------- archived section */}
      {!loading && !error && archivedAccounts.length > 0 ? (
        <section aria-label="Archived accounts" className="rounded-xl border border-hairline bg-card/60">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">
              Archived ({archivedAccounts.length})
            </span>
            <ChevronDown
              className={cn("size-4 text-ink-soft transition-transform", showArchived && "rotate-180")}
              aria-hidden
            />
          </button>
          {showArchived ? (
            <div className="grid gap-3 border-t border-hairline p-3 sm:grid-cols-2 lg:grid-cols-3">
              {archivedAccounts.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  muted
                  busy={busyId === a.id}
                  onViewHistory={() => setHistoryOf(a)}
                  onEdit={() => {
                    setEditing(a);
                    setFormOpen(true);
                  }}
                  onAdjust={() => setAdjusting(a)}
                  onQuickEdit={() => setQuickEditAccount(a)}
                  onMonthlyProgress={() => setMonthlyAccount(a)}
                  onToggleArchive={() => void toggleArchive(a)}
                  onDelete={() => setConfirmDelete(a)}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------------------------------------------------- dialogs */}
      <AccountFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
        onSaved={(message) => {
          setFormOpen(false);
          notifyMutation(message);
        }}
      />

      <QuickEditAmountDialog
        account={quickEditAccount}
        onClose={() => setQuickEditAccount(null)}
        onSaved={(message) => {
          setQuickEditAccount(null);
          notifyMutation(message);
        }}
      />

      <AccountMonthlyProgressDialog
        account={monthlyAccount}
        onClose={() => setMonthlyAccount(null)}
        onAddMonthlyAmount={(month) => {
          if (monthlyAccount) {
            setAddMonthlyFor({ account: monthlyAccount, month });
          }
        }}
      />

      <AddMonthlyAmountDialog
        target={addMonthlyFor}
        onClose={() => setAddMonthlyFor(null)}
        onSaved={(message) => {
          setAddMonthlyFor(null);
          notifyMutation(message);
        }}
      />

      <AccountHistoryDialog account={historyOf} onClose={() => setHistoryOf(null)} />

      <AdjustBalanceDialog
        account={adjusting}
        onClose={() => setAdjusting(null)}
        onSaved={() => {
          setAdjusting(null);
          notifyMutation("Balance reconciled");
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
        title={`Delete ${confirmDelete?.name ?? "account"}?`}
        description="Only accounts with no transactions can be deleted. Accounts with history should be archived instead."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={doDelete}
      />

      {/* ------------------------------------------ transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Transfer money</DialogTitle>
            <DialogDescription>
              Move money between your accounts — transfers never count as income or expense.
            </DialogDescription>
          </DialogHeader>
          <TransactionQuickAdd
            defaultType="TRANSFER"
            onSaved={() => {
              setTransferOpen(false);
              toast.success("Transfer saved");
              window.dispatchEvent(new Event("raqamora:txn-changed"));
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------ account card */

function AccountCard({
  account,
  muted = false,
  busy = false,
  onViewHistory,
  onEdit,
  onAdjust,
  onQuickEdit,
  onMonthlyProgress,
  onToggleArchive,
  onDelete,
}: {
  account: AccountWithBalance;
  muted?: boolean;
  busy?: boolean;
  onViewHistory: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onQuickEdit: () => void;
  onMonthlyProgress: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={cn("spotlight-card rounded-2xl border border-hairline/80 bg-card p-4 sm:p-5 shadow-card transition-all active:scale-[0.99] flex flex-col justify-between", muted && "opacity-60")}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${account.color}1f`, color: account.color }}
              aria-hidden
            >
              <AccountIcon type={account.type} className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-ink">
                <span className="truncate">{account.name}</span>
                {account.archived ? (
                  <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px] uppercase text-ink-soft">
                    Archived
                  </Badge>
                ) : null}
              </h3>
              <p className="truncate text-xs text-ink-soft">
                {ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? String(account.type)}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-ink-soft"
                aria-label={`Manage ${account.name}`}
                disabled={busy}
              >
                <Ellipsis className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onQuickEdit}>
                <Pencil className="size-4" aria-hidden /> Edit amount
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMonthlyProgress}>
                <CalendarRange className="size-4" aria-hidden /> Monthly progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAdjust}>
                <SlidersHorizontal className="size-4" aria-hidden /> Reconcile balance
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="size-4" aria-hidden /> View history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" aria-hidden /> Edit account info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleArchive}>
                {account.archived ? (
                  <ArchiveRestore className="size-4" aria-hidden />
                ) : (
                  <Archive className="size-4" aria-hidden />
                )}
                {account.archived ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-danger-brand focus:bg-danger-brand/10 focus:text-danger-brand"
              >
                <Trash2 className="size-4" aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Money value={account.balance} size="lg" colored />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onQuickEdit}
              className="size-7 rounded-lg text-ink-soft hover:text-ink hover:bg-muted/80 active:scale-95 transition-all"
              title="Edit amount / balance"
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
          <span className="text-[11px] text-ink-soft font-medium">
            {account.txnCount} {account.txnCount === 1 ? "transaction" : "transactions"}
          </span>
        </div>

        {/* Monthly Progress Overview Strip */}
        <div className="mt-3 rounded-2xl bg-muted/40 p-2.5 border border-hairline/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-soft mb-1.5">
            <span className="flex items-center gap-1">
              <Calendar className="size-3 text-brand-emerald" />
              This Month (ماہانہ رپورٹ)
            </span>
            <span
              className={cn(
                "font-bold text-xs",
                (account.thisMonthNet ?? 0) >= 0 ? "text-brand-emerald-deep dark:text-[#53c6ac]" : "text-danger-brand"
              )}
            >
              {(account.thisMonthNet ?? 0) >= 0 ? "+" : "−"}{formatPKR(Math.abs(account.thisMonthNet ?? 0))}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <div className="flex items-center gap-1 text-brand-emerald-deep dark:text-[#53c6ac] truncate">
              <TrendingUp className="size-3.5 shrink-0" />
              <span className="truncate">+{formatPKR(account.thisMonthInflow ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1 text-danger-brand justify-end truncate">
              <TrendingDown className="size-3.5 shrink-0" />
              <span className="truncate">−{formatPKR(account.thisMonthOutflow ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="mt-4 grid grid-cols-2 gap-2 pt-2 border-t border-hairline/60">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onQuickEdit}
          className="min-h-8.5 rounded-xl text-xs font-semibold hover:bg-muted/80 active:scale-95 transition-all shadow-2xs"
        >
          <Pencil className="size-3 mr-1 text-ink-soft" />
          Edit Amount
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onMonthlyProgress}
          className="min-h-8.5 rounded-xl text-xs font-semibold bg-brand-emerald/10 text-brand-emerald-deep hover:bg-brand-emerald/20 dark:text-[#53c6ac] dark:bg-brand-emerald/20 active:scale-95 transition-all shadow-2xs"
        >
          <CalendarRange className="size-3 mr-1" />
          Monthly Report
        </Button>
      </div>
    </article>
  );
}

/* --------------------------------------------------------- new/edit dialog */

type AccountFormInput = z.input<typeof accountSchema>;
type AccountFormOutput = z.output<typeof accountSchema>;

function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountWithBalance | null;
  onSaved: (message: string) => void;
}) {
  const guard = useUnauthorizedGuard();
  const isEdit = account !== null;
  const [saving, setSaving] = React.useState(false);
  const [currentBalance, setCurrentBalance] = React.useState<string>("");

  React.useEffect(() => {
    if (account) {
      setCurrentBalance((account.balance / 100).toString());
    } else {
      setCurrentBalance("");
    }
  }, [account, open]);

  const form = useForm<AccountFormInput, unknown, AccountFormOutput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name ?? "",
      type: (account?.type as AccountType) ?? "CASH",
      openingBalanceRupees: account ? account.openingBalance / 100 : 0,
      color: account?.color ?? PRESET_COLORS[0],
      icon: account?.icon ?? "wallet",
    },
  });
  const errors = form.formState.errors;
  const watchedType = form.watch("type");
  const watchedColor = form.watch("color");
  const watchedIcon = form.watch("icon");

  async function submit(values: AccountFormOutput) {
    setSaving(true);
    try {
      if (isEdit && account) {
        await apiSend(`/api/accounts/${account.id}`, "PATCH", {
          name: values.name.trim(),
          color: values.color,
          icon: values.icon,
        });

        const newBalancePaisa = parseRupeesToPaisa(currentBalance);
        if (newBalancePaisa !== null && newBalancePaisa !== account.balance) {
          const diff = newBalancePaisa - account.balance;
          await apiSend("/api/transactions", "POST", {
            type: "ADJUSTMENT",
            amountRupees: Math.abs(diff) / 100,
            adjustDirection: diff > 0 ? "INCREASE" : "DECREASE",
            accountId: account.id,
            reason: `Balance edited on ${dayFmt.format(new Date())} — recorded ${formatPKR(account.balance)}, new ${formatPKR(newBalancePaisa)}`,
            date: new Date().toISOString(),
          });
        }
        onSaved(`${values.name.trim()} updated`);
      } else {
        await apiSend("/api/accounts", "POST", {
          name: values.name.trim(),
          type: values.type,
          openingBalanceRupees: Number.isFinite(values.openingBalanceRupees)
            ? values.openingBalanceRupees
            : 0,
          color: values.color,
          icon: values.icon,
        });
        onSaved(`${values.name.trim()} created`);
      }
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Could not save the account");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{isEdit ? `Edit ${account?.name}` : "New account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update name, styling, or current balance of this account."
              : "A wallet, bank account or mobile wallet that you track in RAQAMORA."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-3.5">
          <Field label="Name" htmlFor="raqamora-account-name" error={errors.name?.message}>
            <Input
              id="raqamora-account-name"
              placeholder="e.g. Cash in hand / HBL Current"
              maxLength={60}
              className="min-h-11"
              {...form.register("name")}
            />
          </Field>

          <Field
            label="Type"
            hint={isEdit ? "The account type can't be changed after creation." : undefined}
          >
            <Select
              value={watchedType}
              onValueChange={(v) => form.setValue("type", v as AccountType, { shouldValidate: true })}
              disabled={isEdit}
            >
              <SelectTrigger className="min-h-11 w-full" aria-label="Account type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {!isEdit ? (
            <Field
              label="Opening balance (Rs)"
              htmlFor="raqamora-account-opening"
              error={errors.openingBalanceRupees?.message}
              hint="What this wallet holds right now — negative is allowed for overdrafts."
            >
              <Input
                id="raqamora-account-opening"
                type="number"
                inputMode="decimal"
                step="0.01"
                className="min-h-11"
                {...form.register("openingBalanceRupees", { valueAsNumber: true })}
              />
            </Field>
          ) : (
            <Field
              label="Current balance (Rs)"
              htmlFor="raqamora-account-edit-balance"
              hint={`Opening was ${formatPKR(account?.openingBalance ?? 0)}. Changing this updates the current wallet balance.`}
            >
              <Input
                id="raqamora-account-edit-balance"
                type="number"
                inputMode="decimal"
                step="0.01"
                className="min-h-11 font-semibold"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
              />
            </Field>
          )}

          <Field label="Color">
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Account color">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={watchedColor === c}
                  aria-label={`Color ${c}`}
                  onClick={() => form.setValue("color", c, { shouldValidate: true })}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-8 rounded-full border border-black/10 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    watchedColor === c && "ring-2 ring-ink ring-offset-2 ring-offset-background",
                  )}
                />
              ))}
            </div>
          </Field>

          <Field label="Icon">
            <Select
              value={watchedIcon}
              onValueChange={(v) => form.setValue("icon", v, { shouldValidate: true })}
            >
              <SelectTrigger className="min-h-11 w-full" aria-label="Account icon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {ICON_CHOICES.map((name) => (
                  <SelectItem key={name} value={name}>
                    <span className="flex items-center gap-2">
                      <AppIcon name={name} className="size-4 text-ink-soft" />
                      <span className="capitalize">{name.replace(/-/g, " ")}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Button type="submit" className="min-h-11 w-full" disabled={saving}>
            {saving ? <Spinner className="size-4 text-current" /> : null}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------- history dialog */

function AccountHistoryDialog({
  account,
  onClose,
}: {
  account: AccountWithBalance | null;
  onClose: () => void;
}) {
  const guard = useUnauthorizedGuard();
  const [txns, setTxns] = React.useState<TxnRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!account) return;
    let alive = true;
    setTxns(null);
    setError(null);
    apiGet<{ txns: TxnRow[] }>(
      `/api/transactions${qs({ accountId: account.id, sort: "date_desc", pageSize: 50 })}`,
    )
      .then(({ txns: rows }) => {
        if (alive) setTxns(rows);
      })
      .catch((err) => {
        if (!alive || guard(err)) return;
        setError(err instanceof Error ? err.message : "Could not load history");
      });
    return () => {
      alive = false;
    };
  }, [account, guard]);

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center justify-between gap-2 text-base">
            <span className="truncate">{account?.name} — history</span>
            {account ? <Money value={account.balance} size="md" colored /> : null}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Latest 50 transactions for this account.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {txns === null && !error ? <SkeletonList rows={5} /> : null}
          {error ? <EmptyState title="Couldn't load history" description={error} /> : null}
          {txns !== null && txns.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Transactions that touch this account will appear here."
            />
          ) : null}
          {txns?.map((t) => (
            <HistoryRow key={t.id} txn={t} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryRow({ txn }: { txn: TxnRow }) {
  const a = amountView(txn);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-card px-3 py-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft"
        aria-hidden
      >
        <AppIcon name={txn.categoryIcon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">
          {txn.note ?? txn.categoryName ?? typeLabel(txn)}
        </p>
        <p className="truncate text-[11px] text-ink-soft">
          {typeLabel(txn)} · {fmtDay(txn.date)}
          {txn.type === "TRANSFER" && txn.toAccountName ? ` → ${txn.toAccountName}` : ""}
          {txn.personName ? ` · ${txn.personName}` : ""}
        </p>
      </div>
      <span className={cn("money shrink-0 text-[13px] font-semibold", a.className)}>{a.text}</span>
    </div>
  );
}

/* --------------------------------------------------- reconciliation dialog */

function AdjustBalanceDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountWithBalance | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const guard = useUnauthorizedGuard();
  const [actualInput, setActualInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (account) setActualInput("");
  }, [account]);

  const recorded = account?.balance ?? 0;
  const actualPaisa = actualInput.trim() === "" ? null : parseRupeesToPaisa(actualInput);
  const diff = actualPaisa === null ? null : actualPaisa - recorded;

  async function submit() {
    if (!account || actualPaisa === null || diff === null || diff === 0) return;
    setSaving(true);
    try {
      await apiSend("/api/transactions", "POST", {
        type: "ADJUSTMENT",
        amountRupees: Math.abs(diff) / 100,
        adjustDirection: diff > 0 ? "INCREASE" : "DECREASE",
        accountId: account.id,
        reason: `Reconciliation on ${dayFmt.format(new Date())} — recorded ${formatPKR(recorded)}, actual ${formatPKR(actualPaisa)}`,
        date: new Date().toISOString(),
      });
      toast.success(
        diff > 0
          ? `Balance increased by ${formatPKR(Math.abs(diff))}`
          : `Balance decreased by ${formatPKR(Math.abs(diff))}`,
      );
      onSaved();
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Could not record the adjustment");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Adjust balance — {account?.name}</DialogTitle>
          <DialogDescription>
            Compare with your real-world balance. Any difference is recorded as an adjustment
            transaction so RAQAMORA matches reality.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-hairline bg-muted/40 px-3 py-2.5">
            <span className="text-xs text-ink-soft">Recorded balance</span>
            <Money value={recorded} size="md" />
          </div>

          <Field label="Actual balance (Rs)" htmlFor="raqamora-actual-balance">
            <Input
              id="raqamora-actual-balance"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Count your cash or check your app"
              value={actualInput}
              onChange={(e) => setActualInput(e.target.value)}
              className="min-h-11"
              disabled={saving}
            />
          </Field>

          {diff !== null && diff !== 0 ? (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-[12.5px] font-medium leading-snug",
                diff > 0
                  ? "bg-brand-emerald/10 text-brand-emerald-deep"
                  : "bg-danger-brand/10 text-danger-brand",
              )}
              aria-live="polite"
            >
              Difference: {diff > 0 ? "+" : "−"}
              {formatPKR(Math.abs(diff))} — {diff > 0 ? "missing in RAQAMORA, will be added" : "extra in RAQAMORA, will be subtracted"}
            </p>
          ) : diff === 0 ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-[12.5px] text-ink-soft">
              Balances already match — no adjustment needed.
            </p>
          ) : null}

          <Button
            className="min-h-11 w-full"
            disabled={saving || diff === null || diff === 0}
            onClick={() => void submit()}
          >
            {saving ? <Spinner className="size-4 text-current" /> : null}
            {saving
              ? "Recording…"
              : diff !== null && diff !== 0
                ? `Record ${diff > 0 ? "increase" : "decrease"} of ${formatPKR(Math.abs(diff))}`
                : "Record adjustment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------- quick edit amount dialog */

function QuickEditAmountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountWithBalance | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const guard = useUnauthorizedGuard();
  const [amountInput, setAmountInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (account) {
      setAmountInput((account.balance / 100).toString());
    } else {
      setAmountInput("");
    }
  }, [account]);

  const targetPaisa = parseRupeesToPaisa(amountInput);
  const recordedPaisa = account?.balance ?? 0;
  const diff = targetPaisa !== null ? targetPaisa - recordedPaisa : null;

  async function submit() {
    if (!account || targetPaisa === null) return;
    setSaving(true);
    try {
      await apiSend(`/api/accounts/${account.id}`, "PATCH", {
        balanceRupees: targetPaisa / 100,
        openingBalanceRupees: targetPaisa / 100,
      });
      onSaved(`${account.name} ka balance update ho gaya (${formatPKR(targetPaisa)})`);
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Balance update nahi ho saka");
      }
    } finally {
      setSaving(false);
    }
  }

  function addRupees(add: number) {
    const current = Number(amountInput) || 0;
    setAmountInput(Math.max(0, current + add).toString());
  }

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${account?.color}1f`, color: account?.color }}
            >
              <AccountIcon type={account?.type ?? "CASH"} className="size-4" />
            </span>
            <span>Edit Amount — {account?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Account ka mojooda balance update karein taake actual raqam ka hisaab bilkul darust rahay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-hairline bg-muted/40 p-3">
            <span className="text-xs text-ink-soft">Recorded Balance</span>
            <Money value={recordedPaisa} size="md" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="raqamora-quick-amount-input" className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Naya Balance / Amount (Rs)
            </Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-soft">Rs</span>
              <Input
                id="raqamora-quick-amount-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="pl-11 min-h-12 text-lg font-bold"
                disabled={saving}
                autoFocus
              />
            </div>

            {/* Quick Increment Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setAmountInput("0")}
                className="rounded-full border border-hairline/80 px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-muted/80 active:scale-95 transition-all"
              >
                Clear
              </button>
              {[1000, 5000, 10000, 50000, 100000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => addRupees(val)}
                  className="rounded-full border border-hairline/80 px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-muted/80 active:scale-95 transition-all"
                >
                  +{val.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {diff !== null && diff !== 0 && (
            <div
              className={cn(
                "rounded-xl p-3 text-xs font-semibold flex items-center justify-between",
                diff > 0 ? "bg-brand-emerald/10 text-brand-emerald-deep dark:text-[#53c6ac]" : "bg-danger-brand/10 text-danger-brand"
              )}
            >
              <span>{diff > 0 ? "Balance barh jaye ga:" : "Balance kam ho jaye ga:"}</span>
              <span className="font-bold">{diff > 0 ? "+" : "−"}{formatPKR(Math.abs(diff))}</span>
            </div>
          )}

          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving || targetPaisa === null}
            className="w-full min-h-11 font-semibold rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald text-white shadow-md active:scale-95 transition-all"
          >
            {saving ? <Spinner className="size-4 mr-2" /> : <Check className="size-4 mr-1.5" />}
            {saving ? "Saving…" : "Save Amount"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------- add monthly amount dialog */

function AddMonthlyAmountDialog({
  target,
  onClose,
  onSaved,
}: {
  target: { account: AccountWithBalance; month?: string } | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const guard = useUnauthorizedGuard();
  const account = target?.account ?? null;
  const initialMonth = target?.month ?? new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 7);

  const [selectedMonth, setSelectedMonth] = React.useState(initialMonth);
  const [amountRupees, setAmountRupees] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Load categories to pick income category (Salary, Freelance, etc.)
  const cachedCategories = getCachedGet<{ categories: CategoryRow[] }>("/api/categories")?.categories;
  const [categories, setCategories] = React.useState<CategoryRow[]>(() => cachedCategories?.filter((c) => c.kind === "INCOME") ?? []);
  const [categoryId, setCategoryId] = React.useState<string>("");

  React.useEffect(() => {
    if (target?.month) setSelectedMonth(target.month);
    setAmountRupees("");
    setNote("");
  }, [target]);

  React.useEffect(() => {
    if (categories.length === 0) {
      apiGet<{ categories: CategoryRow[] }>("/api/categories")
        .then(({ categories: all }) => {
          const inc = all.filter((c) => c.kind === "INCOME");
          setCategories(inc);
          if (inc.length > 0 && !categoryId) setCategoryId(inc[0].id);
        })
        .catch(() => {});
    } else if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Options for months: current month and past 11 months + next month
  const monthOptions = React.useMemo(() => {
    const list: Array<{ value: string; label: string }> = [];
    const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const curKey = now.toISOString().slice(0, 7);

    // Add next month
    const [cy, cm] = curKey.split("-").map(Number);
    const nextKey = new Date(Date.UTC(cy, cm, 15)).toISOString().slice(0, 7);
    list.push({ value: nextKey, label: fmtMonthLabel(nextKey) });

    // Add current and past 11 months
    for (let i = 0; i < 12; i++) {
      const k = new Date(Date.UTC(cy, cm - 1 - i, 15)).toISOString().slice(0, 7);
      list.push({ value: k, label: fmtMonthLabel(k) });
    }
    return list;
  }, []);

  async function submit() {
    if (!account || !amountRupees || Number(amountRupees) <= 0) {
      toast.error("Valid amount darj karein");
      return;
    }
    setSaving(true);
    try {
      const monthLabel = fmtMonthLabel(selectedMonth);
      const isCur = selectedMonth === new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 7);
      const dateStr = isCur ? new Date().toISOString() : `${selectedMonth}-01T10:00:00.000Z`;

      await apiSend("/api/transactions", "POST", {
        type: "INCOME",
        amountRupees: Number(amountRupees),
        accountId: account.id,
        categoryId: categoryId || null,
        date: dateStr,
        note: note.trim() || `${monthLabel} Monthly Inflow`,
      });

      onSaved(`Rs ${Number(amountRupees).toLocaleString()} successfully added to ${monthLabel} for ${account.name}!`);
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Raqam add nahi ho saki");
      }
    } finally {
      setSaving(false);
    }
  }

  function addQuick(val: number) {
    const current = Number(amountRupees) || 0;
    setAmountRupees((current + val).toString());
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${account?.color}1f`, color: account?.color }}
            >
              <AccountIcon type={account?.type ?? "CASH"} className="size-4" />
            </span>
            <span>Add Monthly Amount — {account?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Is account mein kisi bhi mahine ki aamdani, salary ya starting balance add karein.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Month (مہینہ منتخب کریں)
            </Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <Label htmlFor="raqamora-monthly-amount-input" className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Amount (Rs)
            </Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-soft">Rs</span>
              <Input
                id="raqamora-monthly-amount-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="50,000"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="pl-11 min-h-12 text-lg font-bold"
                disabled={saving}
                autoFocus
              />
            </div>

            {/* Quick Increments */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setAmountRupees("")}
                className="rounded-full border border-hairline/80 px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-muted/80 active:scale-95 transition-all"
              >
                Clear
              </button>
              {[5000, 10000, 25000, 50000, 100000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => addQuick(val)}
                  className="rounded-full border border-hairline/80 px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-muted/80 active:scale-95 transition-all"
                >
                  +{val.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                Category (قسم)
              </Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <AppIcon name={c.icon} className="size-4 text-ink-soft" />
                        <span>{c.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="raqamora-monthly-note" className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Note (تفصیل / اختیاری)
            </Label>
            <Input
              id="raqamora-monthly-note"
              placeholder="e.g. Monthly Salary / Initial Deposit"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-10 text-sm"
              disabled={saving}
            />
          </div>

          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !amountRupees || Number(amountRupees) <= 0}
            className="w-full min-h-11 font-semibold rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald text-white shadow-md active:scale-95 transition-all"
          >
            {saving ? <Spinner className="size-4 mr-2" /> : <Plus className="size-4 mr-1.5" />}
            {saving ? "Saving…" : `Save ${amountRupees ? `• Rs ${Number(amountRupees).toLocaleString()}` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------- monthly progress dialog */

function AccountMonthlyProgressDialog({
  account,
  onClose,
  onAddMonthlyAmount,
}: {
  account: AccountWithBalance | null;
  onClose: () => void;
  onAddMonthlyAmount: (month?: string) => void;
}) {
  const guard = useUnauthorizedGuard();
  const [data, setData] = React.useState<AccountMonthlyResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = React.useState<string>("");

  const fetchMonthly = React.useCallback(() => {
    if (!account) return;
    setLoading(true);
    setError(null);
    apiGet<AccountMonthlyResponse>(`/api/accounts/${account.id}/monthly`)
      .then((res) => {
        setData(res);
        if (!selectedMonthKey && res.currentMonth) {
          setSelectedMonthKey(res.currentMonth);
        }
      })
      .catch((err) => {
        if (!guard(err)) {
          setError(err instanceof Error ? err.message : "Could not load monthly progress");
        }
      })
      .finally(() => setLoading(false));
  }, [account, guard, selectedMonthKey]);

  React.useEffect(() => {
    if (account) {
      setSelectedMonthKey("");
      fetchMonthly();
    }
  }, [account, fetchMonthly]);

  // Refetch when transactions change
  React.useEffect(() => {
    const handler = () => fetchMonthly();
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, [fetchMonthly]);

  const [inlineAmount, setInlineAmount] = React.useState("");
  const [savingInline, setSavingInline] = React.useState(false);

  const activeRecord = React.useMemo(() => {
    if (!data) return null;
    return data.months.find((m) => m.month === selectedMonthKey) ?? data.months[0] ?? null;
  }, [data, selectedMonthKey]);

  async function handleSaveInlineAmount() {
    if (!account || !inlineAmount || Number(inlineAmount) <= 0) return;
    setSavingInline(true);
    try {
      const isCur = selectedMonthKey === new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 7);
      const dateStr = isCur ? new Date().toISOString() : `${selectedMonthKey}-01T10:00:00.000Z`;

      await apiSend("/api/transactions", "POST", {
        type: "INCOME",
        amountRupees: Number(inlineAmount),
        accountId: account.id,
        date: dateStr,
        note: `${activeRecord?.monthLabel ?? selectedMonthKey} Monthly Amount`,
      });

      toast.success(`Rs ${Number(inlineAmount).toLocaleString()} added to ${activeRecord?.monthLabel ?? selectedMonthKey}!`);
      setInlineAmount("");
      window.dispatchEvent(new Event("raqamora:txn-changed"));
      fetchMonthly();
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Raqam add nahi ho saki");
      }
    } finally {
      setSavingInline(false);
    }
  }

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b border-hairline">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${account?.color}1f`, color: account?.color }}
              >
                <AccountIcon type={account?.type ?? "CASH"} className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>{account?.name}</span>
                  <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wider">
                    Monthly Progress
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-ink-soft">
                  Har mahine ka alag record, aamdani, kharcha aur bachat ki progress.
                </DialogDescription>
              </div>
            </div>
            {account && <Money value={account.balance} size="md" colored />}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 [scrollbar-width:thin]">
          {loading && !data && <SkeletonList rows={4} />}
          {error && <EmptyState title="Couldn't load monthly progress" description={error} actionLabel="Retry" onAction={fetchMonthly} />}

          {data && activeRecord && (
            <>
              {/* Month Selector Bar */}
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 p-1.5 border border-hairline">
                <Select value={selectedMonthKey} onValueChange={setSelectedMonthKey}>
                  <SelectTrigger className="h-9 border-none bg-transparent hover:bg-muted font-bold text-xs">
                    <Calendar className="size-3.5 mr-1.5 text-brand-emerald" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {data.months.map((m) => (
                      <SelectItem key={m.month} value={m.month}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{m.monthLabel}</span>
                          <span className={cn("text-[11px] font-semibold", m.net >= 0 ? "text-brand-emerald-deep" : "text-danger-brand")}>
                            {m.net >= 0 ? "+" : "−"}{formatPKR(Math.abs(m.net))}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={() => onAddMonthlyAmount(selectedMonthKey)}
                  className="h-8 rounded-xl bg-brand-emerald text-white text-xs font-semibold shadow-sm active:scale-95"
                >
                  <Plus className="size-3.5 mr-1" /> Is Mahine Ki Raqam Add Karein
                </Button>
              </div>

              {/* Quick Write Amount Inline Card */}
              <div className="rounded-2xl border border-brand-emerald/40 bg-brand-emerald/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Pencil className="size-3.5 text-brand-emerald" />
                    <span>{activeRecord.monthLabel} ki Raqam Likhein (Write Amount):</span>
                  </span>
                  <span className="text-[11px] text-ink-soft">
                    Selected Month: <strong>{activeRecord.monthLabel}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-soft">Rs</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder={`e.g. 50,000 for ${activeRecord.monthLabel}`}
                      value={inlineAmount}
                      onChange={(e) => setInlineAmount(e.target.value)}
                      className="pl-9 h-10 text-sm font-bold bg-card"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleSaveInlineAmount()}
                    disabled={!inlineAmount || Number(inlineAmount) <= 0 || savingInline}
                    className="h-10 px-4 rounded-xl font-semibold bg-brand-emerald text-white active:scale-95 shadow-sm shrink-0"
                  >
                    {savingInline ? "Saving…" : "Save Raqam"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onAddMonthlyAmount(selectedMonthKey)}
                    className="h-10 px-3 rounded-xl text-xs font-semibold hover:bg-muted shrink-0"
                    title="Detailed form"
                  >
                    Details
                  </Button>
                </div>
                {/* Quick Increment Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] text-ink-soft mr-1">Quick:</span>
                  {[5000, 10000, 25000, 50000, 100000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        const cur = Number(inlineAmount) || 0;
                        setInlineAmount((cur + val).toString());
                      }}
                      className="rounded-full border border-hairline/80 px-2.5 py-0.5 text-[10.5px] font-medium text-ink-soft hover:bg-muted/80 active:scale-95 transition-all bg-card/60"
                    >
                      +{val.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setInlineAmount("")}
                    className="rounded-full border border-hairline/80 px-2.5 py-0.5 text-[10.5px] font-medium text-ink-soft hover:bg-muted/80 active:scale-95 transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Active Month 3-Card Summary */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Inflow */}
                <div className="rounded-2xl border border-hairline/80 bg-card p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-brand-emerald-deep dark:text-[#53c6ac] mb-1">
                    <TrendingUp className="size-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Aaya / Inflow</span>
                  </div>
                  <Money value={activeRecord.inflow} size="md" className="text-brand-emerald-deep dark:text-[#53c6ac] font-bold" />
                  <p className="text-[10.5px] text-ink-soft mt-1">Total added</p>
                </div>

                {/* Outflow */}
                <div className="rounded-2xl border border-hairline/80 bg-card p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-danger-brand mb-1">
                    <TrendingDown className="size-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Kharcha</span>
                  </div>
                  <Money value={activeRecord.outflow} size="md" className="text-danger-brand font-bold" />
                  <p className="text-[10.5px] text-ink-soft mt-1">Total spent</p>
                </div>

                {/* Net Progress */}
                <div className="rounded-2xl border border-hairline/80 bg-card p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-ink-soft mb-1">
                    <Sparkles className="size-3.5 text-gold" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Net Bachat</span>
                  </div>
                  <span className={cn(
                    "text-[15px] font-extrabold truncate block",
                    activeRecord.net >= 0 ? "text-brand-emerald-deep dark:text-[#53c6ac]" : "text-danger-brand"
                  )}>
                    {activeRecord.net >= 0 ? "+" : "−"}{formatPKR(Math.abs(activeRecord.net))}
                  </span>
                  <p className="text-[10.5px] text-ink-soft mt-1">
                    {activeRecord.savingsRate > 0 ? `${activeRecord.savingsRate}% bachat` : "0% savings"}
                  </p>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="rounded-2xl border border-hairline/80 bg-card p-4 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{activeRecord.monthLabel} Progress & Health</span>
                  <span className={cn(
                    "font-bold",
                    activeRecord.net >= 0 ? "text-brand-emerald-deep dark:text-[#53c6ac]" : "text-danger-brand"
                  )}>
                    {activeRecord.net >= 0 ? `Bachat hui: ${activeRecord.savingsRate}%` : "Kharcha aamdani se zyada"}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                  {activeRecord.inflow > 0 ? (
                    <>
                      <div
                        style={{ width: `${Math.min(100, Math.round((activeRecord.outflow / activeRecord.inflow) * 100))}%` }}
                        className="bg-danger-brand/80 transition-all"
                        title={`Spent: ${formatPKR(activeRecord.outflow)}`}
                      />
                      <div
                        style={{ width: `${Math.max(0, 100 - Math.min(100, Math.round((activeRecord.outflow / activeRecord.inflow) * 100)))}%` }}
                        className="bg-brand-emerald transition-all"
                        title={`Saved: ${formatPKR(Math.max(0, activeRecord.net))}`}
                      />
                    </>
                  ) : (
                    <div className="w-full bg-muted-foreground/20 text-center text-[9px] text-ink-soft flex items-center justify-center">
                      Koi entry nahi
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-soft">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-danger-brand" />
                    Kharch: {formatPKR(activeRecord.outflow)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-brand-emerald" />
                    Bachat: {formatPKR(Math.max(0, activeRecord.net))}
                  </span>
                  <span>Month End Balance: {formatPKR(activeRecord.endingBalance)}</span>
                </div>
              </div>

              {/* Month-by-Month Full Comparison */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                    Mahana Progress History (تمام مہینوں کی رپورٹ)
                  </h4>
                  <span className="text-[11px] text-ink-soft">
                    Past {data.months.length} months
                  </span>
                </div>

                <div className="space-y-2">
                  {data.months.map((m) => {
                    const isSelected = m.month === selectedMonthKey;
                    return (
                      <div
                        key={m.month}
                        className={cn(
                          "rounded-2xl border p-3.5 transition-all flex items-center justify-between gap-3",
                          isSelected
                            ? "border-brand-emerald bg-brand-emerald/5 shadow-sm ring-1 ring-brand-emerald/30"
                            : "border-hairline bg-card hover:bg-muted/30"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-ink">{m.monthLabel}</span>
                            {m.month === data.currentMonth && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase text-brand-emerald border-brand-emerald/40">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft mt-1">
                            <span className="text-brand-emerald-deep dark:text-[#53c6ac] font-medium">
                              +{formatPKR(m.inflow)} in
                            </span>
                            <span className="text-danger-brand font-medium">
                              −{formatPKR(m.outflow)} out
                            </span>
                            <span>{m.txnCount} txns</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className={cn(
                              "text-xs font-bold block",
                              m.net >= 0 ? "text-brand-emerald-deep dark:text-[#53c6ac]" : "text-danger-brand"
                            )}>
                              {m.net >= 0 ? "+" : "−"}{formatPKR(Math.abs(m.net))}
                            </span>
                            <span className="text-[10px] text-ink-soft block">
                              End: {formatPKR(m.endingBalance)}
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onAddMonthlyAmount(m.month)}
                            className="h-8 px-2 text-xs font-semibold rounded-xl text-brand-emerald hover:bg-brand-emerald/10"
                            title="Add amount to this month"
                          >
                            <Plus className="size-3.5 mr-0.5" /> Amount
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
