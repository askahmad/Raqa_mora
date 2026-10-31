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
  ChevronDown,
  Ellipsis,
  History,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
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
import type { AccountWithBalance, TxnRow } from "@/lib/raqamora/types";
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
  onToggleArchive,
  onDelete,
}: {
  account: AccountWithBalance;
  muted?: boolean;
  busy?: boolean;
  onViewHistory: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={cn("spotlight-card rounded-2xl border border-hairline/80 bg-card p-4 sm:p-5 shadow-card transition-all active:scale-[0.99]", muted && "opacity-60")}>
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
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onViewHistory}>
              <History className="size-4" aria-hidden /> View history
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAdjust}>
              <SlidersHorizontal className="size-4" aria-hidden /> Adjust balance
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

      <div className="mt-3 flex items-end justify-between gap-2">
        <Money value={account.balance} size="lg" colored />
        <span className="text-[11px] text-ink-soft">
          {account.txnCount} {account.txnCount === 1 ? "transaction" : "transactions"}
        </span>
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
        // PATCH supports name/color/icon/archived only — balance corrections
        // happen through the Adjust balance (reconciliation) flow.
        await apiSend(`/api/accounts/${account.id}`, "PATCH", {
          name: values.name.trim(),
          color: values.color,
          icon: values.icon,
        });
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
              ? "Rename or restyle the account. Correct the running balance with Adjust balance."
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
            <p className="rounded-lg border border-hairline bg-muted/40 px-3 py-2.5 text-[12px] leading-snug text-ink-soft">
              Opening balance {formatPKR(account?.openingBalance ?? 0)} — to correct the running
              balance, use <strong className="font-semibold text-ink">Adjust balance</strong> from
              the account menu.
            </p>
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
