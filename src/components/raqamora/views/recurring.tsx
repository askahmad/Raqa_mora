"use client";

/**
 * RAQAMORA Recurring view — scheduled income, bills and transfers.
 * Rules never run by themselves: transactions are created only when
 * "Process due now" is used (which also catches up every missed occurrence).
 */
import * as React from "react";
import { format } from "date-fns";
import {
  Info,
  Pencil,
  PlayCircle,
  Plus,
  Repeat,
  SkipForward,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend } from "@/lib/raqamora/client";
import { parseRupeesToPaisa } from "@/lib/raqamora/money";
import type { AccountWithBalance, CategoryRow, RecurringRow } from "@/lib/raqamora/types";
import { useApp } from "@/components/raqamora/app-root";
import {
  ConfirmDialog,
  EmptyState,
  Money,
  PageHeader,
  SkeletonList,
  Spinner,
  TypeBadge,
} from "@/components/raqamora/kit";
import type { ViewProps } from "@/components/raqamora/view-props";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------- labels */

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function karachiTodayKey(): string {
  return new Date(Date.now() + KARACHI_OFFSET_MS).toISOString().slice(0, 10);
}

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const CHIP = {
  amber:
    "border-warn-brand/30 bg-warn-brand/10 text-[#7c5d1d] dark:border-warn-brand/35 dark:bg-warn-brand/20 dark:text-[#d9b25f]",
  red: "border-danger-brand/25 bg-danger-brand/10 text-danger-brand dark:border-danger-brand/35 dark:bg-danger-brand/20 dark:text-[#e08a7f]",
  neutral: "border-hairline bg-muted text-ink-soft",
} as const;

function amountTone(type: string): string {
  if (type === "INCOME") return "text-money-pos";
  if (type === "EXPENSE") return "text-money-neg";
  return "text-ink";
}

function ruleMeta(r: RecurringRow): string {
  if (r.type === "TRANSFER") {
    if (!r.accountName && !r.toAccountName) return "No accounts set";
    return `${r.accountName ?? "—"} → ${r.toAccountName ?? "—"}`;
  }
  return [r.categoryName, r.accountName].filter(Boolean).join(" · ") || "No category or account set";
}

function nextChip(r: RecurringRow): { label: string; cls: string } {
  const next = format(new Date(r.nextDate), "EEE d MMM");
  if (!r.active) return { label: `Paused · next ${next}`, cls: CHIP.neutral };
  const days = (new Date(r.nextDate).getTime() - Date.now()) / 86_400_000;
  if (days <= 0) return { label: `Due now · ${next}`, cls: CHIP.red };
  if (days <= 3) return { label: `Next: ${next}`, cls: CHIP.amber };
  return { label: `Next: ${next}`, cls: CHIP.neutral };
}

/* ------------------------------------------------------------- Rule dialog */

const REC_TYPES = ["INCOME", "EXPENSE", "TRANSFER"] as const;
const REC_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

function RuleDialog({
  open,
  onOpenChange,
  accounts,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountWithBalance[];
  categories: CategoryRow[];
  onSaved: () => void;
}) {
  const { handleUnauthorized } = useApp();
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<(typeof REC_TYPES)[number]>("EXPENSE");
  const [amount, setAmount] = React.useState("");
  const [frequency, setFrequency] = React.useState<(typeof REC_FREQUENCIES)[number]>("MONTHLY");
  const [nextDate, setNextDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setType("EXPENSE");
    setAmount("");
    setFrequency("MONTHLY");
    setNextDate(karachiTodayKey());
    setEndDate("");
    setNote("");
    setAccountId(accounts[0]?.id ?? "");
    setToAccountId("");
    setCategoryId("");
    setFieldError(null);
  }, [open, accounts]);

  const relevantCategories = React.useMemo(
    () => categories.filter((c) => !c.archived && c.kind === type),
    [categories, type],
  );

  function changeType(next: string) {
    const t = next as (typeof REC_TYPES)[number];
    setType(t);
    setCategoryId("");
    setFieldError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const paisa = parseRupeesToPaisa(amount);
    if (!title.trim()) {
      setFieldError("Give the rule a title");
      return;
    }
    if (paisa === null || paisa <= 0) {
      setFieldError("Enter an amount greater than zero");
      return;
    }
    if (!nextDate) {
      setFieldError("Pick the next date");
      return;
    }
    if (type !== "TRANSFER" && !accountId) {
      setFieldError("Choose an account");
      return;
    }
    if (type !== "TRANSFER" && !categoryId) {
      setFieldError("Choose a category");
      return;
    }
    if (type === "TRANSFER") {
      if (!accountId || !toAccountId) {
        setFieldError("Transfers need a from and a to account");
        return;
      }
      if (accountId === toAccountId) {
        setFieldError("From and to accounts must be different");
        return;
      }
    }
    setSaving(true);
    try {
      await apiSend("/api/recurring", "POST", {
        title: title.trim(),
        type,
        amountRupees: paisa / 100,
        frequency,
        nextDate,
        endDate: endDate || null,
        note: note.trim() || null,
        accountId: accountId || null,
        toAccountId: type === "TRANSFER" ? toAccountId : null,
        categoryId: type === "TRANSFER" ? null : categoryId,
      });
      toast.success("Rule created");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not create the rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New recurring rule</DialogTitle>
          <DialogDescription>Rent, salary, Netflix — set them once and process when due.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-title">Title</Label>
            <Input
              id="rule-title"
              placeholder="House rent"
              maxLength={80}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-type">Type</Label>
              <Select value={type} onValueChange={changeType}>
                <SelectTrigger id="rule-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "INCOME" ? "Income" : t === "EXPENSE" ? "Expense" : "Transfer"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-amount">Amount (Rs)</Label>
              <Input
                id="rule-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="18,000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setFieldError(null);
                }}
                aria-invalid={fieldError ? true : undefined}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-frequency">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as (typeof REC_FREQUENCIES)[number])}>
                <SelectTrigger id="rule-frequency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REC_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-next">Next date</Label>
              <Input
                id="rule-next"
                type="date"
                value={nextDate}
                onChange={(e) => {
                  setNextDate(e.target.value);
                  setFieldError(null);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-account">{type === "TRANSFER" ? "From account" : "Account"}</Label>
              <Select value={accountId} onValueChange={(v) => { setAccountId(v); setFieldError(null); }}>
                <SelectTrigger id="rule-account" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => !a.archived).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "TRANSFER" ? (
              <div className="space-y-1.5">
                <Label htmlFor="rule-to-account">To account</Label>
                <Select value={toAccountId} onValueChange={(v) => { setToAccountId(v); setFieldError(null); }}>
                  <SelectTrigger id="rule-to-account" className="w-full">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => !a.archived).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="rule-category">Category</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setFieldError(null); }}>
                  <SelectTrigger id="rule-category" className="w-full">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {relevantCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-end">End date (optional)</Label>
              <Input id="rule-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-note">Note (optional)</Label>
              <Input
                id="rule-note"
                maxLength={500}
                placeholder="Paid from HBL"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-hairline bg-muted/40 px-3 py-2.5">
            <label className="flex items-start gap-2.5">
              <Checkbox checked disabled className="mt-0.5" aria-label="Generate past occurrences when processed" />
              <span className="text-xs leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">If already overdue, generate past occurrences on save</span>
                <br />
                Always on — “Process due now” catches up every missed occurrence automatically.
              </span>
            </label>
          </div>

          {fieldError ? <p className="text-xs font-medium text-danger-brand">{fieldError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 text-current" /> : null}
              Create rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------- Edit rule dialog */

/**
 * The API contract only allows PATCHing amount, nextDate, note and active on an
 * existing rule — so the edit dialog edits exactly those fields.
 */
function EditRuleDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: RecurringRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { handleUnauthorized } = useApp();
  const [amount, setAmount] = React.useState("");
  const [nextDate, setNextDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!rule) return;
    setAmount(String(rule.amount / 100));
    setNextDate(rule.nextDate.slice(0, 10));
    setNote(rule.note ?? "");
    setFieldError(null);
  }, [rule]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rule) return;
    const paisa = parseRupeesToPaisa(amount);
    if (paisa === null || paisa <= 0) {
      setFieldError("Enter an amount greater than zero");
      return;
    }
    if (!nextDate) {
      setFieldError("Pick the next date");
      return;
    }
    setSaving(true);
    try {
      await apiSend(`/api/recurring/${rule.id}`, "PATCH", {
        amountRupees: paisa / 100,
        nextDate,
        note: note.trim() || null,
      });
      toast.success("Rule updated");
      onClose();
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not update the rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={rule !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit rule</DialogTitle>
          <DialogDescription>
            {rule ? `“${rule.title}” — you can change the amount, next date and note.` : undefined}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-rule-amount">Amount (Rs)</Label>
            <Input
              id="edit-rule-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-rule-next">Next date</Label>
            <Input
              id="edit-rule-next"
              type="date"
              value={nextDate}
              onChange={(e) => {
                setNextDate(e.target.value);
                setFieldError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-rule-note">Note (optional)</Label>
            <Textarea
              id="edit-rule-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {fieldError ? <p className="text-xs font-medium text-danger-brand">{fieldError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 text-current" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- View */

export default function RecurringView(_props: ViewProps) {
  const { handleUnauthorized } = useApp();
  const [rules, setRules] = React.useState<RecurringRow[] | null>(null);
  const [accounts, setAccounts] = React.useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [processing, setProcessing] = React.useState(false);
  const [skippingId, setSkippingId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<RecurringRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RecurringRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const { recurring } = await apiGet<{ recurring: RecurringRow[] }>("/api/recurring");
      setRules(recurring);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Could not load recurring rules");
    }
  }, [handleUnauthorized]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ accounts: accs }, { categories: cats }] = await Promise.all([
          apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts"),
          apiGet<{ categories: CategoryRow[] }>("/api/categories"),
        ]);
        if (alive) {
          setAccounts(accs);
          setCategories(cats);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) handleUnauthorized();
      }
    })();
    return () => {
      alive = false;
    };
  }, [handleUnauthorized]);

  /* Transactions changed elsewhere → refresh rule state */
  React.useEffect(() => {
    const handler = () => void load();
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, [load]);

  function replaceRule(updated: RecurringRow) {
    setRules((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
  }

  async function processDue() {
    setProcessing(true);
    try {
      const { created } = await apiSend<{ created: number }>("/api/recurring/run", "POST");
      toast.success(
        created > 0
          ? `Created ${created} transaction${created === 1 ? "" : "s"} from due rules`
          : "Nothing due right now",
      );
      await load();
      window.dispatchEvent(new Event("raqamora:txn-changed"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not process due rules");
    } finally {
      setProcessing(false);
    }
  }

  async function toggleActive(r: RecurringRow, active: boolean) {
    try {
      const { recurring } = await apiSend<{ recurring: RecurringRow }>(`/api/recurring/${r.id}`, "PATCH", {
        active,
      });
      replaceRule(recurring);
      toast.success(active ? `“${r.title}” activated` : `“${r.title}” paused`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not update the rule");
      void load();
    }
  }

  async function skipNext(r: RecurringRow) {
    setSkippingId(r.id);
    try {
      const { recurring } = await apiSend<{ recurring: RecurringRow }>(`/api/recurring/${r.id}/skip`, "POST");
      replaceRule(recurring);
      toast.success(`“${r.title}” skipped — next is ${format(new Date(recurring.nextDate), "EEE d MMM")}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not skip this occurrence");
    } finally {
      setSkippingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/recurring/${deleteTarget.id}`, "DELETE");
      toast.success(`“${deleteTarget.title}” deleted — transactions already created stay in your history`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not delete the rule");
    } finally {
      setDeleting(false);
    }
  }

  const dueCount = React.useMemo(
    () => (rules ?? []).filter((r) => r.active && new Date(r.nextDate).getTime() <= Date.now()).length,
    [rules],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recurring"
        description="Rent, salary, subscriptions — set them once."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => void processDue()} disabled={processing}>
              {processing ? <Spinner className="size-4 text-current" /> : <PlayCircle className="size-4" aria-hidden />}
              Process due now{dueCount > 0 ? ` (${dueCount})` : ""}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New rule
            </Button>
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-lg border border-hairline bg-card px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
        <Info className="mt-0.5 size-3.5 shrink-0 text-gold-deep" aria-hidden />
        <span>
          Rules create real transactions only when processed with <strong className="font-medium text-ink">Process due
          now</strong> — nothing is charged automatically, not even on app load.
        </span>
      </div>

      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-brand/25 bg-danger-brand/[0.05] px-4 py-3">
          <p className="text-sm text-danger-brand">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {rules === null && !loadError ? <SkeletonList rows={3} /> : null}

      {rules !== null && rules.length === 0 && !loadError ? (
        <EmptyState
          icon={Repeat}
          title="No recurring rules yet"
          description="Rent, salary, Netflix — set them once. Process due rules with one tap whenever you open the app."
          actionLabel="New rule"
          onAction={() => setCreateOpen(true)}
        />
      ) : null}

      {rules !== null && rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((r) => {
            const chip = nextChip(r);
            return (
              <article key={r.id} className="rounded-xl border border-hairline bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="truncate text-sm font-semibold text-ink">{r.title}</h3>
                      <TypeBadge type={r.type} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">{ruleMeta(r)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="px-1.5 text-[10px] text-ink-soft">
                        {FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                      </Badge>
                      <Badge variant="outline" className={cn("px-1.5 text-[10px]", chip.cls)}>
                        {chip.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Money value={r.amount} size="md" className={amountTone(r.type)} />
                    <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                      {r.active ? "Active" : "Paused"}
                      <Switch
                        checked={r.active}
                        onCheckedChange={(v) => void toggleActive(r, v)}
                        aria-label={`${r.active ? "Pause" : "Activate"} rule ${r.title}`}
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-8"
                    disabled={!r.active || skippingId === r.id}
                    onClick={() => void skipNext(r)}
                  >
                    {skippingId === r.id ? (
                      <Spinner className="size-3.5 text-current" />
                    ) : (
                      <SkipForward className="size-3.5" aria-hidden />
                    )}
                    Skip next
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-8 text-ink-soft"
                    onClick={() => setEditingRule(r)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <span className="grow" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-ink-soft hover:text-danger-brand"
                    onClick={() => setDeleteTarget(r)}
                    aria-label={`Delete rule ${r.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <RuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={accounts}
        categories={categories}
        onSaved={() => void load()}
      />

      <EditRuleDialog
        rule={editingRule}
        onClose={() => setEditingRule(null)}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this rule?"
        description={
          deleteTarget
            ? `Stops “${deleteTarget.title}” from being scheduled again. Transactions already created from it stay in your history.`
            : undefined
        }
        confirmLabel="Delete rule"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
