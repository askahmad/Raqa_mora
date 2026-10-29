"use client";

/**
 * RAQAMORA Savings Goals view — tracked intentions, not account movements.
 * Contributions never touch account balances; each goal card shows progress,
 * target-date health (overdue / on track) and an expandable contribution history.
 */
import * as React from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  ChevronDown,
  Coins,
  History,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend } from "@/lib/raqamora/client";
import { formatPKR, parseRupeesToPaisa } from "@/lib/raqamora/money";
import type { GoalRow } from "@/lib/raqamora/types";
import { useApp } from "@/components/raqamora/app-root";
import {
  ConfirmDialog,
  EmptyState,
  Money,
  PageHeader,
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
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------ Karachi date utils */

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function karachiNow(): Date {
  return new Date(Date.now() + KARACHI_OFFSET_MS);
}

function karachiTodayKey(): string {
  return karachiNow().toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------- chips */

const CHIP = {
  emerald:
    "border-brand-emerald/25 bg-brand-emerald/10 text-brand-emerald-deep dark:border-brand-emerald/35 dark:bg-brand-emerald/20 dark:text-[#53c6ac]",
  amber:
    "border-warn-brand/30 bg-warn-brand/10 text-[#7c5d1d] dark:border-warn-brand/35 dark:bg-warn-brand/20 dark:text-[#d9b25f]",
  red: "border-danger-brand/25 bg-danger-brand/10 text-danger-brand dark:border-danger-brand/35 dark:bg-danger-brand/20 dark:text-[#e08a7f]",
  neutral: "border-hairline bg-muted text-ink-soft",
} as const;

function goalDateChip(goal: GoalRow): { label: string; cls: string } | null {
  if (!goal.targetDate) return null;
  const dateLabel = format(new Date(goal.targetDate), "d MMM yyyy");
  const done = goal.percent >= 100;
  const overdue = !done && goal.targetDate.slice(0, 10) < karachiTodayKey();
  if (done) return { label: `Completed · ${dateLabel}`, cls: CHIP.emerald };
  if (overdue) return { label: `Overdue · was ${dateLabel}`, cls: CHIP.red };
  // Pace: how far through the savings window are we vs how much is saved.
  const times = goal.contributions.map((c) => new Date(c.date).getTime());
  const start = times.length > 0 ? Math.min(...times) : Date.now();
  const windowMs = new Date(goal.targetDate).getTime() - start;
  if (windowMs > 0) {
    const pacePercent = ((Date.now() - start) / windowMs) * 100;
    if (goal.percent >= pacePercent) return { label: `On track · ${dateLabel}`, cls: CHIP.emerald };
    return { label: `Target ${dateLabel}`, cls: CHIP.amber };
  }
  return { label: `Target ${dateLabel}`, cls: CHIP.neutral };
}

/* -------------------------------------------------------------------- bars */

function GoalBar({ percent, tone }: { percent: number; tone: "ok" | "behind" | "done" }) {
  const color = tone === "done" || tone === "ok" ? "bg-brand-emerald" : "bg-warn-brand";
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.round(percent))}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", color)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- Goal dialog */

function GoalDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: GoalRow | null;
  onSaved: () => void;
}) {
  const { handleUnauthorized } = useApp();
  const [name, setName] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [targetDate, setTargetDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setTarget(String(editing.targetAmount / 100));
      setTargetDate(editing.targetDate ? editing.targetDate.slice(0, 10) : "");
      setNote(editing.note ?? "");
    } else {
      setName("");
      setTarget("");
      setTargetDate("");
      setNote("");
    }
    setFieldError(null);
  }, [open, editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError("Give your goal a name");
      return;
    }
    const paisa = parseRupeesToPaisa(target);
    if (paisa === null || paisa <= 0) {
      setFieldError("Enter a target amount greater than zero");
      return;
    }
    setSaving(true);
    const payload = {
      name: trimmed,
      targetAmountRupees: paisa / 100,
      targetDate: targetDate || null,
      note: note.trim() || null,
    };
    try {
      if (editing) {
        await apiSend(`/api/goals/${editing.id}`, "PATCH", payload);
        toast.success("Goal updated");
      } else {
        await apiSend("/api/goals", "POST", payload);
        toast.success("Goal created — every rupee counts");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not save the goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit goal" : "New savings goal"}</DialogTitle>
          <DialogDescription>
            A target to save towards — Hajj, a bike, an emergency fund. The target date is optional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Goal name</Label>
            <Input
              id="goal-name"
              placeholder="Hajj fund"
              value={name}
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Target amount (Rs)</Label>
            <Input
              id="goal-target"
              inputMode="decimal"
              autoComplete="off"
              placeholder="250,000"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Target date (optional)</Label>
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-note">Note (optional)</Label>
            <Textarea
              id="goal-note"
              rows={2}
              placeholder="Why this matters to you…"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {fieldError ? <p className="text-xs font-medium text-danger-brand">{fieldError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 text-current" /> : null}
              {editing ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------- Contribute dialog */

function ContributeDialog({
  goal,
  onClose,
  onSaved,
}: {
  goal: GoalRow | null;
  onClose: () => void;
  onSaved: (goalId: string) => void;
}) {
  const { handleUnauthorized } = useApp();
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!goal) return;
    setAmount("");
    setDate(karachiTodayKey());
    setNote("");
    setFieldError(null);
  }, [goal]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal) return;
    const paisa = parseRupeesToPaisa(amount);
    if (paisa === null || paisa <= 0) {
      setFieldError("Enter an amount greater than zero");
      return;
    }
    if (!date) {
      setFieldError("Pick a date");
      return;
    }
    setSaving(true);
    try {
      await apiSend("/api/goals/contribute", "POST", {
        goalId: goal.id,
        amountRupees: paisa / 100,
        date,
        note: note.trim() || null,
      });
      toast.success(`Added to “${goal.name}” — keep going`);
      onSaved(goal.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not record the contribution");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={goal !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add contribution</DialogTitle>
          <DialogDescription>{goal ? `Towards “${goal.name}”` : undefined}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contrib-amount">Amount (Rs)</Label>
            <Input
              id="contrib-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="5,000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-date">Date</Label>
            <Input
              id="contrib-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setFieldError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrib-note">Note (optional)</Label>
            <Textarea
              id="contrib-note"
              rows={2}
              placeholder="e.g. from this month's bonus"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {fieldError ? <p className="text-xs font-medium text-danger-brand">{fieldError}</p> : null}
          <p className="rounded-lg bg-muted px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
            Contributions track your intention — money stays in your accounts.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 text-current" /> : <Coins className="size-4" aria-hidden />}
              Add contribution
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- View */

export default function GoalsView(_props: ViewProps) {
  const { handleUnauthorized } = useApp();
  const [goals, setGoals] = React.useState<GoalRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [goalDialogOpen, setGoalDialogOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<GoalRow | null>(null);
  const [contributing, setContributing] = React.useState<GoalRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<GoalRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [flashId, setFlashId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const { goals: rows } = await apiGet<{ goals: GoalRow[] }>("/api/goals");
      setGoals(rows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Could not load goals");
    }
  }, [handleUnauthorized]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!flashId) return;
    const id = window.setTimeout(() => setFlashId(null), 1400);
    return () => window.clearTimeout(id);
  }, [flashId]);

  const sorted = React.useMemo(
    () => [...(goals ?? [])].sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name)),
    [goals],
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditingGoal(null);
    setGoalDialogOpen(true);
  }

  function openEdit(g: GoalRow) {
    setEditingGoal(g);
    setGoalDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/goals/${deleteTarget.id}`, "DELETE");
      toast.success(`“${deleteTarget.name}” deleted`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not delete the goal");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Savings Goals"
        description="Targets you're saving towards — money stays in your accounts."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New goal
          </Button>
        }
      />

      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-brand/25 bg-danger-brand/[0.05] px-4 py-3">
          <p className="text-sm text-danger-brand">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {goals === null && !loadError ? <SkeletonList rows={3} /> : null}

      {goals !== null && goals.length === 0 && !loadError ? (
        <EmptyState
          icon={PiggyBank}
          title="No goals yet"
          description="Saving for Hajj, a bike, or an emergency fund? Set your first target."
          actionLabel="New goal"
          onAction={openCreate}
        />
      ) : null}

      {sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((g) => {
            const chip = goalDateChip(g);
            const done = g.percent >= 100;
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            const tone: "ok" | "behind" | "done" =
              done ? "done" : chip?.cls === CHIP.amber ? "behind" : "ok";
            const isOpen = expanded.has(g.id);
            return (
              <article
                key={g.id}
                className={cn(
                  "rounded-xl border border-hairline bg-card p-4 shadow-card transition-shadow",
                  flashId === g.id && "ring-2 ring-brand-emerald/40",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{g.name}</h3>
                    {g.note ? <p className="mt-0.5 truncate text-xs text-ink-soft">{g.note}</p> : null}
                  </div>
                  {chip ? (
                    <Badge variant="outline" className={cn("shrink-0 px-1.5 text-[10px]", chip.cls)}>
                      <CalendarClock className="mr-1 size-3" aria-hidden />
                      {chip.label}
                    </Badge>
                  ) : null}
                </div>

                <GoalBar percent={g.percent} tone={tone} />

                <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <Money value={g.currentAmount} size="lg" className={done ? "text-brand-emerald-deep" : undefined} />
                    <span className="text-xs text-ink-soft">
                      of <span className="money">{formatPKR(g.targetAmount)}</span> · {g.percent}%
                    </span>
                  </div>
                  {!done && remaining > 0 ? (
                    <span className="text-xs text-ink-soft">
                      <span className="money text-ink">{formatPKR(remaining)}</span> to go
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-brand-emerald-deep dark:text-[#53c6ac]">
                      Goal reached 🎉
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={done ? "outline" : "default"}
                    onClick={() => setContributing(g)}
                    className="min-h-8"
                  >
                    <Coins className="size-3.5" aria-hidden />
                    Add contribution
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-8 text-ink-soft"
                    onClick={() => toggleExpanded(g.id)}
                    aria-expanded={isOpen}
                  >
                    <History className="size-3.5" aria-hidden />
                    History ({g.contributions.length})
                    <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </Button>
                  <span className="grow" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-ink-soft hover:text-ink"
                    onClick={() => openEdit(g)}
                    aria-label={`Edit goal ${g.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-ink-soft hover:text-danger-brand"
                    onClick={() => setDeleteTarget(g)}
                    aria-label={`Delete goal ${g.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {isOpen ? (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-hairline bg-muted/40">
                    {g.contributions.length === 0 ? (
                      <p className="px-3 py-3 text-center text-xs text-ink-soft">No contributions yet</p>
                    ) : (
                      <ul className="divide-y divide-hairline">
                        {g.contributions.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-ink">
                                {format(new Date(c.date), "d MMM yyyy")}
                              </p>
                              {c.note ? (
                                <p className="truncate text-[11px] text-ink-soft">{c.note}</p>
                              ) : null}
                            </div>
                            <Money value={c.amount} size="sm" className="shrink-0 text-brand-emerald-deep dark:text-[#53c6ac]" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <GoalDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen} editing={editingGoal} onSaved={() => void load()} />

      <ContributeDialog
        goal={contributing}
        onClose={() => setContributing(null)}
        onSaved={(goalId) => {
          setFlashId(goalId);
          void load();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this goal?"
        description={
          deleteTarget
            ? `Deletes “${deleteTarget.name}” and its ${deleteTarget.contributions.length} contribution record${deleteTarget.contributions.length === 1 ? "" : "s"}. The history cannot be recovered — your account balances were never touched.`
            : undefined
        }
        confirmLabel="Delete goal"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
