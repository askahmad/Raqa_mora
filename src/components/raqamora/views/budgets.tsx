"use client";

/**
 * RAQAMORA Budgets view — monthly category limits with Karachi-month navigation.
 * Budget rows show spent vs limit for the selected month; overall card warns at
 * the user's threshold (amber) and flags overspending (red).
 */
import * as React from "react";
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Info,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend, qs } from "@/lib/raqamora/client";
import { formatPKR, parseRupeesToPaisa } from "@/lib/raqamora/money";
import type { BudgetRow, CategoryRow } from "@/lib/raqamora/types";
import { useApp } from "@/components/raqamora/app-root";
import { AppIcon } from "@/components/raqamora/icon";
import {
  ConfirmDialog,
  EmptyState,
  Money,
  PageHeader,
  SectionCard,
  SkeletonList,
  Spinner,
} from "@/components/raqamora/kit";
import type { ViewProps } from "@/components/raqamora/view-props";

import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ------------------------------------------------------ Karachi date utils */

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Current instant shifted into Karachi's clock so UTC parts read as Karachi. */
function karachiNow(): Date {
  return new Date(Date.now() + KARACHI_OFFSET_MS);
}

function karachiMonthKey(): string {
  return karachiNow().toISOString().slice(0, 7);
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/* ------------------------------------------------------------------- tones */

type Tone = "ok" | "warn" | "over";

function toneFor(percent: number, threshold: number): Tone {
  if (percent > 100) return "over";
  if (percent >= threshold) return "warn";
  return "ok";
}

const BAR_TONES: Record<Tone, string> = {
  ok: "bg-brand-emerald",
  warn: "bg-warn-brand",
  over: "bg-danger-brand",
};

const BADGE_TONES: Record<Tone, string> = {
  ok: "border-brand-emerald/25 bg-brand-emerald/10 text-brand-emerald-deep dark:border-brand-emerald/35 dark:bg-brand-emerald/20 dark:text-[#53c6ac]",
  warn: "border-warn-brand/30 bg-warn-brand/10 text-[#7c5d1d] dark:border-warn-brand/35 dark:bg-warn-brand/20 dark:text-[#d9b25f]",
  over:
    "border-danger-brand/25 bg-danger-brand/10 text-danger-brand dark:border-danger-brand/35 dark:bg-danger-brand/20 dark:text-[#e08a7f]",
};

function Bar({ percent, tone, className }: { percent: number; tone: Tone; className?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", BAR_TONES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ Budget dialog */

function BudgetDialog({
  open,
  onOpenChange,
  monthKey,
  categories,
  editing,
  presetCategoryId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthKey: string;
  categories: CategoryRow[];
  editing: BudgetRow | null;
  presetCategoryId: string | null;
  onSaved: () => void;
}) {
  const { handleUnauthorized } = useApp();
  const [categoryId, setCategoryId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setCategoryId(editing.categoryId);
      setAmount(String(editing.amount / 100));
    } else {
      setCategoryId(presetCategoryId ?? "");
      setAmount("");
    }
    setFieldError(null);
  }, [open, editing, presetCategoryId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const paisa = parseRupeesToPaisa(amount);
    if (paisa === null || paisa <= 0) {
      setFieldError("Enter a budget amount greater than zero");
      return;
    }
    if (!editing && !categoryId) {
      setFieldError("Choose a category to budget");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiSend(`/api/budgets/${editing.id}`, "PATCH", { amountRupees: paisa / 100 });
        toast.success("Budget updated");
      } else {
        await apiSend("/api/budgets", "POST", { categoryId, amountRupees: paisa / 100, month: monthKey });
        toast.success("Budget saved");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not save the budget");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit budget" : "Set a budget"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Adjust the monthly limit for ${editing.categoryName}.`
              : `A monthly spending limit for ${monthLabel(monthKey)}. Saving the same category again updates its limit.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget-category">Category</Label>
            {editing ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-hairline bg-muted px-3 text-sm text-ink">
                <AppIcon name={editing.categoryIcon} className="size-4 text-ink-soft" />
                {editing.categoryName}
              </div>
            ) : (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="budget-category" className="w-full" aria-invalid={fieldError ? true : undefined}>
                  <SelectValue placeholder="Choose an expense category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-ink-soft">No expense categories found</div>
                  ) : (
                    categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Monthly limit (Rs)</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="15,000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
            />
          </div>
          {fieldError ? <p className="text-xs font-medium text-danger-brand">{fieldError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 text-current" /> : null}
              {editing ? "Save changes" : "Set budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- View */

export default function BudgetsView({ user }: ViewProps) {
  const { handleUnauthorized } = useApp();
  const [monthKey, setMonthKey] = React.useState<string>(() => karachiMonthKey());
  const [budgets, setBudgets] = React.useState<BudgetRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BudgetRow | null>(null);
  const [presetCategoryId, setPresetCategoryId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BudgetRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const { budgets: rows } = await apiGet<{ budgets: BudgetRow[] }>(`/api/budgets${qs({ month: monthKey })}`);
      setBudgets(rows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Could not load budgets");
    }
  }, [monthKey, handleUnauthorized]);

  React.useEffect(() => {
    setBudgets(null);
    void load();
  }, [load]);

  /* Expense categories for the set-budget dialog */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { categories: rows } = await apiGet<{ categories: CategoryRow[] }>("/api/categories");
        if (alive) setCategories(rows.filter((c) => !c.archived && c.kind === "EXPENSE"));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) handleUnauthorized();
        /* dialog still validates server-side */
      }
    })();
    return () => {
      alive = false;
    };
  }, [handleUnauthorized]);

  /* Transactions changed elsewhere → refresh used amounts */
  React.useEffect(() => {
    const handler = () => void load();
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, [load]);

  const totals = React.useMemo(() => {
    const list = budgets ?? [];
    let limit = 0;
    let used = 0;
    for (const b of list) {
      limit += b.amount;
      used += b.used;
    }
    return { limit, used, remaining: limit - used, percent: limit > 0 ? Math.round((used / limit) * 100) : 0 };
  }, [budgets]);

  const sorted = React.useMemo(() => [...(budgets ?? [])].sort((a, b) => b.percent - a.percent), [budgets]);

  const foodCategoryId = React.useMemo(() => {
    const food = categories.find((c) => /food/i.test(c.name));
    return food?.id ?? null;
  }, [categories]);

  const overallTone = toneFor(totals.percent, user.warnThreshold);
  const overspentBy = totals.used - totals.limit;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/budgets/${deleteTarget.id}`, "DELETE");
      toast.success(`Budget for ${deleteTarget.categoryName} removed`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not delete the budget");
    } finally {
      setDeleting(false);
    }
  }

  function openCreate(preset: string | null = null) {
    setEditing(null);
    setPresetCategoryId(preset);
    setDialogOpen(true);
  }

  function openEdit(b: BudgetRow) {
    setEditing(b);
    setPresetCategoryId(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Budgets"
        description="Monthly category limits — warnings are reminders, not transactions."
        actions={
          <>
            {/* Month navigation */}
            <div
              className="flex items-center gap-0.5 rounded-lg border border-hairline bg-card p-0.5 shadow-card"
              role="group"
              aria-label="Budget month"
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="flex min-w-36 items-center justify-center gap-1.5 px-1 text-[13px] font-medium text-ink">
                <CalendarRange className="size-3.5 text-ink-soft" aria-hidden />
                {monthLabel(monthKey)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              size="sm"
              className="min-h-9 rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald text-white font-semibold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:brightness-105 active:scale-95 transition-all"
              onClick={() => openCreate()}
            >
              <Plus className="size-4 mr-1.5" aria-hidden />
              Set budget
            </Button>
          </>
        }
      />

      {/* Overall card */}
      <SectionCard
        title={`${monthLabel(monthKey)} overview`}
        subtitle={budgets && budgets.length > 0 ? `${budgets.length} category limit${budgets.length === 1 ? "" : "s"}` : undefined}
      >
        {budgets === null ? (
          <SkeletonList rows={2} />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">Total limit</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <Money value={totals.limit} size="xl" />
                  <span className="text-xs text-ink-soft">
                    of <span className="money">{formatPKR(totals.used)}</span> used ·{" "}
                    <span className="money">{totals.percent}%</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">Remaining</p>
                <Money
                  value={totals.remaining}
                  size="lg"
                  className={cn(totals.remaining < 0 && "text-danger-brand")}
                />
              </div>
            </div>
            <Bar percent={totals.percent} tone={overallTone} className="mt-4 h-2" />
            {overspentBy > 0 ? (
              <div
                className="mt-3 flex items-center gap-2 rounded-lg border border-danger-brand/25 bg-danger-brand/[0.06] px-3 py-2 text-xs font-medium text-danger-brand"
                role="alert"
              >
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                <span>
                  Overspent by <span className="money">{formatPKR(overspentBy)}</span> — review the categories below.
                </span>
              </div>
            ) : null}
          </>
        )}
      </SectionCard>

      {/* Load error */}
      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-brand/25 bg-danger-brand/[0.05] px-4 py-3">
          <p className="text-sm text-danger-brand">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Budget rows */}
      {budgets !== null && budgets.length === 0 && !loadError ? (
        <EmptyState
          icon={Target}
          title="Set your first budget"
          description="Food & Groceries Rs 15,000 is a common start — adjust the limit anytime as you learn your rhythm."
          actionLabel="Set a budget"
          onAction={() => openCreate(foodCategoryId)}
        />
      ) : null}

      {sorted.length > 0 ? (
        <SectionCard title="Category budgets" contentClassName="space-y-2.5">
          {sorted.map((b) => {
            const tone = toneFor(b.percent, user.warnThreshold);
            return (
              <div key={b.id} className="rounded-lg border border-hairline p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft">
                    <AppIcon name={b.categoryIcon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink">{b.categoryName}</p>
                      <Badge variant="outline" className={cn("shrink-0 px-1.5 text-[10px]", BADGE_TONES[tone])}>
                        {b.percent}%
                      </Badge>
                    </div>
                    <Bar percent={b.percent} tone={tone} className="mt-2" />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-ink-soft">
                      {b.used === 0 ? (
                        <span>No spending yet · limit {formatPKR(b.amount)}</span>
                      ) : (
                        <span>
                          Spent <span className="money text-ink">{formatPKR(b.used)}</span> of{" "}
                          <span className="money">{formatPKR(b.amount)}</span>
                        </span>
                      )}
                      {b.remaining >= 0 ? (
                        <span>
                          <span className="money text-ink">{formatPKR(b.remaining)}</span> left
                        </span>
                      ) : (
                        <span className="font-medium text-danger-brand">
                          Over by <span className="money">{formatPKR(-b.remaining)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-ink-soft hover:text-ink"
                      onClick={() => openEdit(b)}
                      aria-label={`Edit budget for ${b.categoryName}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-ink-soft hover:text-danger-brand"
                      onClick={() => setDeleteTarget(b)}
                      aria-label={`Delete budget for ${b.categoryName}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </SectionCard>
      ) : null}

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-soft">
        <Info className="size-3 shrink-0" aria-hidden />
        Budget warnings are reminders, not transactions.
      </p>

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        monthKey={monthKey}
        categories={categories}
        editing={editing}
        presetCategoryId={presetCategoryId}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this budget?"
        description={
          deleteTarget
            ? `Removes the ${formatPKR(deleteTarget.amount)} limit on ${deleteTarget.categoryName} for ${monthLabel(deleteTarget.month)}. Your spending history is not touched.`
            : undefined
        }
        confirmLabel="Delete budget"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
