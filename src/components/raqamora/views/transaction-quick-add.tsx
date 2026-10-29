"use client";

/**
 * RAQAMORA transaction quick-add — the flagship capture form.
 *
 * One type-driven form for all nine transaction kinds. Money is entered in
 * rupees and sent to the API as `amountRupees` numbers (the API edge converts
 * to integer paisa). Flows:
 * - INCOME / EXPENSE / REFUND / TRANSFER / ADJUSTMENT → POST /api/transactions
 * - LENT / BORROWED + "ledger entry" checkbox → POST /api/debts (recordNow: true)
 *   which atomically creates the Debt AND the linked LENT/BORROWED transaction.
 * - REPAYMENT_RECEIVED / REPAYMENT_MADE → POST /api/transactions with debtId,
 *   capped client-side at the selected debt's outstanding amount.
 */
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  HandCoins,
  Handshake,
  RotateCcw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend, qs } from "@/lib/raqamora/client";
import { formatPKR, formatRupees } from "@/lib/raqamora/money";
import { TXN_TYPE_LABELS, txnFieldRequirements, type TxnType } from "@/lib/raqamora/finance";
import { transactionSchema } from "@/lib/raqamora/validation";
import type {
  AccountWithBalance,
  CategoryRow,
  DebtWithOutstanding,
  PersonRow,
} from "@/lib/raqamora/types";
import { useApp } from "@/components/raqamora/app-root";
import { AppIcon } from "@/components/raqamora/icon";
import { EmptyState, SkeletonList, Spinner } from "@/components/raqamora/kit";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------- date utils */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** datetime-local value → ISO instant, interpreted as Asia/Karachi wall time. */
export function karachiDateTimeIso(value: string): string {
  if (!value) return new Date().toISOString();
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const d = new Date(`${withSeconds}+05:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** "YYYY-MM-DD" → ISO instant at noon Karachi (avoids day-boundary edges). */
function karachiDateNoonIso(value: string): string {
  const d = new Date(`${value}T12:00:00+05:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/* ---------------------------------------------------------- shared helpers */

/**
 * Stable 401 guard — safe to call from effects/handlers without re-triggering
 * them when the app context identity changes. Returns true when handled.
 */
export function useUnauthorizedGuard(): (err: unknown) => boolean {
  const { handleUnauthorized } = useApp();
  const ref = React.useRef(handleUnauthorized);
  React.useEffect(() => {
    ref.current = handleUnauthorized;
  }, [handleUnauthorized]);
  return React.useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      ref.current();
      return true;
    }
    return false;
  }, []);
}

/** Labeled field shell with hint + inline error used across RAQAMORA forms. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </Label>
      {children}
      {hint && !error ? <p className="text-[11.5px] leading-snug text-ink-soft">{hint}</p> : null}
      {error ? (
        <p className="text-[11.5px] font-medium text-danger-brand" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- config */

const TYPE_GRID: Array<{ type: TxnType; icon: LucideIcon }> = [
  { type: "INCOME", icon: TrendingUp },
  { type: "EXPENSE", icon: TrendingDown },
  { type: "TRANSFER", icon: ArrowLeftRight },
  { type: "LENT", icon: HandCoins },
  { type: "BORROWED", icon: Handshake },
  { type: "REPAYMENT_RECEIVED", icon: ArrowDownLeft },
  { type: "REPAYMENT_MADE", icon: ArrowUpRight },
  { type: "REFUND", icon: RotateCcw },
  { type: "ADJUSTMENT", icon: SlidersHorizontal },
];

function isRepayment(t: TxnType): boolean {
  return t === "REPAYMENT_RECEIVED" || t === "REPAYMENT_MADE";
}

function isLentBorrowed(t: TxnType): boolean {
  return t === "LENT" || t === "BORROWED";
}

function accountLabelFor(t: TxnType): string {
  switch (t) {
    case "INCOME":
    case "BORROWED":
    case "REPAYMENT_RECEIVED":
    case "REFUND":
      return "Received in";
    case "EXPENSE":
    case "LENT":
    case "REPAYMENT_MADE":
      return "Paid from";
    default:
      return "Account";
  }
}

/* ------------------------------------------------------------ props/types */

export type TransactionQuickAddProps = {
  onSaved: () => void;
  /** Preselected type — defaults to EXPENSE. */
  defaultType?: TxnType;
};

/* -------------------------------------------------------- AddPersonInline */

/** Inline "add person" mini-form used beside the person select. */
function AddPersonInline({ onAdded }: { onAdded: (person: PersonRow) => void }) {
  const guard = useUnauthorizedGuard();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const { person } = await apiSend<{ person: PersonRow }>("/api/people", "POST", { name: trimmed });
      toast.success(`${person.name} added to your people`);
      onAdded(person);
      setOpen(false);
      setName("");
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Could not add the person");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 gap-1.5 px-3 text-xs"
          title="Add a new person"
        >
          <UserPlus className="size-4" aria-hidden />
          <span>New</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-2"
        >
          <Label htmlFor="raqamora-new-person" className="text-xs font-medium text-ink">
            New person
          </Label>
          <Input
            id="raqamora-new-person"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ahmed Raza"
            maxLength={80}
            autoFocus
          />
          <Button type="submit" size="sm" className="w-full" disabled={!name.trim() || saving}>
            {saving ? <Spinner className="size-4 text-current" /> : null}
            Add person
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------- AccountSelect bit */

function AccountSelect({
  accounts,
  value,
  onChange,
  excludeId,
  placeholder,
}: {
  accounts: AccountWithBalance[];
  value: string | null | undefined;
  onChange: (id: string) => void;
  excludeId?: string | null;
  placeholder: string;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="min-h-11 w-full" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id} disabled={excludeId === a.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: a.color }}
                aria-hidden
              />
              <span className="truncate">{a.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------ the form */

export default function TransactionQuickAdd({ onSaved, defaultType = "EXPENSE" }: TransactionQuickAddProps) {
  const guard = useUnauthorizedGuard();

  /* ---- base reference data, fetched once on open ---- */
  const [accounts, setAccounts] = React.useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [people, setPeople] = React.useState<PersonRow[]>([]);
  const [loadState, setLoadState] = React.useState<"loading" | "ready" | "error">("loading");

  const loadBase = React.useCallback(() => {
    setLoadState("loading");
    Promise.all([
      apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts"),
      apiGet<{ categories: CategoryRow[] }>("/api/categories"),
      apiGet<{ people: PersonRow[] }>("/api/people"),
    ])
      .then(([a, c, p]) => {
        setAccounts(a.accounts.filter((acc) => !acc.archived));
        setCategories(c.categories.filter((cat) => !cat.archived));
        setPeople(p.people);
        setLoadState("ready");
      })
      .catch((err) => {
        if (guard(err)) return;
        setLoadState("error");
      });
  }, [guard]);

  React.useEffect(() => {
    loadBase();
  }, [loadBase]);

  /* ---- form ---- */
  type FormInput = z.input<typeof transactionSchema>;
  type FormOutput = z.output<typeof transactionSchema>;

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      amountRupees: Number.NaN,
      date: toLocalInputValue(new Date()),
      note: null,
      accountId: null,
      toAccountId: null,
      categoryId: null,
      personId: null,
      debtId: null,
      reason: null,
      adjustDirection: undefined,
    },
  });
  const { setValue, getValues } = form;
  const errors = form.formState.errors;

  const type = form.watch("type");
  const req = txnFieldRequirements(type);
  const watchedPersonId = form.watch("personId");
  const watchedDebtId = form.watch("debtId");
  const watchedAccountId = form.watch("accountId");
  const watchedToAccountId = form.watch("toAccountId");
  const watchedCategoryId = form.watch("categoryId");
  const adjustDirection = form.watch("adjustDirection");

  /* ---- ledger checkbox + due date (LENT/BORROWED only) ---- */
  const [createLedger, setCreateLedger] = React.useState(true);
  const [dueDate, setDueDate] = React.useState("");

  /* ---- active debts for repayments ---- */
  const [debts, setDebts] = React.useState<DebtWithOutstanding[]>([]);
  const [debtsLoading, setDebtsLoading] = React.useState(false);
  const debtReqRef = React.useRef(0);

  const loadDebts = React.useCallback(
    (personId: string, direction: "RECEIVABLE" | "PAYABLE") => {
      const requestId = ++debtReqRef.current;
      setDebtsLoading(true);
      apiGet<{ debts: DebtWithOutstanding[] }>(
        `/api/debts${qs({ direction, status: "ACTIVE" })}`,
      )
        .then(({ debts: list }) => {
          if (debtReqRef.current !== requestId) return;
          setDebts(list.filter((d) => d.personId === personId));
        })
        .catch((err) => {
          if (debtReqRef.current !== requestId) return;
          if (!guard(err)) toast.error("Could not load active debts for this person");
        })
        .finally(() => {
          if (debtReqRef.current === requestId) setDebtsLoading(false);
        });
    },
    [guard],
  );

  function selectType(next: TxnType) {
    if (next === type) return;
    const nextReq = txnFieldRequirements(next);
    setValue("type", next);
    if (!nextReq.needsToAccount) setValue("toAccountId", null);
    if (!nextReq.needsPerson) setValue("personId", null);
    setValue("debtId", null);
    setDebts([]);
    if (!nextReq.needsCategory) {
      setValue("categoryId", null);
    } else {
      const current = categories.find((c) => c.id === getValues("categoryId"));
      const wantKind = next === "INCOME" ? "INCOME" : "EXPENSE";
      if (!current || current.kind !== wantKind) setValue("categoryId", null);
    }
    if (!nextReq.needsReason) setValue("reason", null);
    if (next === "ADJUSTMENT") {
      if (getValues("adjustDirection") !== "DECREASE") setValue("adjustDirection", "INCREASE");
    } else {
      setValue("adjustDirection", undefined);
    }
    form.clearErrors();
    if (isRepayment(next)) {
      const personId = getValues("personId");
      if (personId) {
        loadDebts(personId, next === "REPAYMENT_RECEIVED" ? "RECEIVABLE" : "PAYABLE");
      }
    }
  }

  function handlePersonChange(personId: string) {
    setValue("personId", personId, { shouldValidate: true });
    setValue("debtId", null);
    setDebts([]);
    if (isRepayment(type)) {
      loadDebts(personId, type === "REPAYMENT_RECEIVED" ? "RECEIVABLE" : "PAYABLE");
    }
  }

  const selectedDebt = debts.find((d) => d.id === watchedDebtId) ?? null;
  const fromAccount = accounts.find((a) => a.id === watchedAccountId) ?? null;
  const toAccount = accounts.find((a) => a.id === watchedToAccountId) ?? null;

  function handleDebtChange(id: string) {
    setValue("debtId", id, { shouldValidate: true });
    const debt = debts.find((d) => d.id === id);
    // Auto-fill the max repayable ONLY when the user hasn't entered an amount
    // yet — never overwrite a value they typed.
    const current = form.getValues("amountRupees");
    if (debt && (current === undefined || current === null || Number.isNaN(current) || current === 0)) {
      setValue("amountRupees", debt.outstanding / 100, { shouldValidate: true });
    }
  }

  function fillMax() {
    if (!selectedDebt) return;
    setValue("amountRupees", selectedDebt.outstanding / 100, { shouldValidate: true });
  }

  /* ---- submit ---- */
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    const t = values.type;
    const paisa = Math.round(values.amountRupees * 100);

    if (isRepayment(t)) {
      if (!values.debtId) {
        form.setError("debtId", { message: "Select the debt this repayment is against" });
        return;
      }
      if (selectedDebt && paisa > selectedDebt.outstanding) {
        form.setError("amountRupees", {
          message: `Cannot exceed outstanding Rs ${formatRupees(selectedDebt.outstanding)}`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isLentBorrowed(t) && createLedger) {
        // One atomic call creates the Debt + the LENT/BORROWED transaction.
        await apiSend("/api/debts", "POST", {
          personId: values.personId ?? "",
          direction: t === "LENT" ? "RECEIVABLE" : "PAYABLE",
          principalRupees: values.amountRupees,
          note: values.note?.trim() || null,
          accountId: values.accountId ?? null,
          dueDate: dueDate ? karachiDateNoonIso(dueDate) : null,
          recordNow: true,
        });
        toast.success(
          t === "LENT"
            ? `Lent ${formatPKR(paisa)} — ledger entry created`
            : `Borrowed ${formatPKR(paisa)} — ledger entry created`,
        );
      } else {
        await apiSend("/api/transactions", "POST", {
          type: t,
          amountRupees: values.amountRupees,
          date: karachiDateTimeIso(values.date),
          note: values.note?.trim() || null,
          accountId: values.accountId ?? null,
          toAccountId: t === "TRANSFER" ? (values.toAccountId ?? null) : null,
          categoryId: values.categoryId ?? null,
          personId: values.personId ?? null,
          debtId: isRepayment(t) ? (values.debtId ?? null) : null,
          reason: t === "ADJUSTMENT" ? (values.reason?.trim() || null) : null,
          adjustDirection: t === "ADJUSTMENT" ? values.adjustDirection : undefined,
        });
        toast.success(`${TXN_TYPE_LABELS[t]} of ${formatPKR(paisa)} saved`);
      }
      onSaved();
    } catch (err) {
      if (guard(err)) return;
      toast.error(err instanceof Error ? err.message : "Could not save the transaction");
    } finally {
      setSubmitting(false);
    }
  });

  /* ---- loading / error / empty shells ---- */
  if (loadState === "loading") {
    return <SkeletonList rows={4} />;
  }
  if (loadState === "error") {
    return (
      <EmptyState
        title="Couldn't load your accounts & categories"
        description="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => loadBase()}
      />
    );
  }
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No accounts yet"
        description="Every transaction is recorded against an account. Create your first account from the Accounts page, then come back here."
      />
    );
  }

  const categoryKind = type === "INCOME" ? "INCOME" : "EXPENSE";
  const kindCategories = categories.filter((c) => c.kind === categoryKind);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {/* ---------------------------------------------------- type grid */}
      <div>
        <Label className="text-[13px] font-medium text-ink">Type</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Transaction type">
          {TYPE_GRID.map(({ type: t, icon: Icon }) => {
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectType(t)}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-brand-emerald bg-brand-emerald/10 text-brand-emerald-deep ring-2 ring-brand-emerald/50 dark:text-[#53c6ac]"
                    : "border-hairline bg-card text-ink-soft hover:border-brand-emerald/50 hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {TXN_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ amount + date */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount" error={errors.amountRupees?.message}>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-soft"
              aria-hidden
            >
              Rs
            </span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              autoFocus
              aria-invalid={Boolean(errors.amountRupees)}
              className="min-h-11 pl-10 pr-14 text-[15px] font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              {...form.register("amountRupees", { valueAsNumber: true })}
            />
            {isRepayment(type) && selectedDebt ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={fillMax}
                className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 px-2 text-[11px] font-semibold"
              >
                Max
              </Button>
            ) : null}
          </div>
        </Field>
        <Field label="Date & time" htmlFor="raqamora-txn-date" error={errors.date?.message}>
          <Input
            id="raqamora-txn-date"
            type="datetime-local"
            className="min-h-11"
            {...form.register("date")}
          />
        </Field>
      </div>

      {/* ------------------------------------------------------- person */}
      {req.needsPerson ? (
        <Field
          label="Person"
          error={errors.personId?.message}
          hint={
            isRepayment(type)
              ? "Repayments are recorded against this person's active debt."
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={watchedPersonId ?? ""}
                onValueChange={(v) => handlePersonChange(v)}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="Select a person">
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="truncate">{p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AddPersonInline
              onAdded={(person) => {
                setPeople((prev) =>
                  [...prev, person].sort((a, b) => a.name.localeCompare(b.name)),
                );
                handlePersonChange(person.id);
              }}
            />
          </div>
        </Field>
      ) : null}

      {/* ------------------------------------ debt select (repayments) */}
      {isRepayment(type) ? (
        <Field
          label={type === "REPAYMENT_RECEIVED" ? "Debt to collect against" : "Debt to pay against"}
          error={errors.debtId?.message}
          hint={
            selectedDebt
              ? `Outstanding ${formatPKR(selectedDebt.outstanding)} of ${formatPKR(selectedDebt.principal)}`
              : undefined
          }
        >
          {!watchedPersonId ? (
            <Select disabled>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="Choose a person first" />
              </SelectTrigger>
            </Select>
          ) : debtsLoading ? (
            <div className="flex min-h-11 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-xs text-ink-soft">
              <Spinner className="size-3.5" /> Loading active debts…
            </div>
          ) : debts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline bg-muted/40 px-3 py-2.5 text-[12px] leading-snug text-ink-soft">
              No active {type === "REPAYMENT_RECEIVED" ? "receivable" : "payable"} debts for this
              person. Record money lent/borrowed with a ledger entry first.
            </p>
          ) : (
            <Select value={watchedDebtId ?? ""} onValueChange={handleDebtChange}>
              <SelectTrigger className="min-h-11 w-full" aria-label="Select the debt">
                <SelectValue placeholder="Select the debt" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {debts.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {formatPKR(d.principal)} · outstanding {formatPKR(d.outstanding)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      ) : null}

      {/* ------------------------------------------------------ account */}
      {req.needsAccount && !req.needsToAccount ? (
        <Field
          label={accountLabelFor(type)}
          error={errors.accountId?.message}
          hint={fromAccount ? `Available balance ${formatPKR(fromAccount.balance)}` : undefined}
        >
          <AccountSelect
            accounts={accounts}
            value={watchedAccountId}
            onChange={(v) => setValue("accountId", v, { shouldValidate: true })}
            placeholder={accountLabelFor(type)}
          />
        </Field>
      ) : null}

      {/* ------------------------------------ transfer from/to accounts */}
      {req.needsToAccount ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="From account"
            error={errors.accountId?.message}
            hint={fromAccount ? `Available balance ${formatPKR(fromAccount.balance)}` : undefined}
          >
            <AccountSelect
              accounts={accounts}
              value={watchedAccountId}
              onChange={(v) => setValue("accountId", v, { shouldValidate: true })}
              excludeId={watchedToAccountId}
              placeholder="From account"
            />
          </Field>
          <Field
            label="To account"
            error={errors.toAccountId?.message}
            hint={toAccount ? `Current balance ${formatPKR(toAccount.balance)}` : undefined}
          >
            <AccountSelect
              accounts={accounts}
              value={watchedToAccountId}
              onChange={(v) => setValue("toAccountId", v, { shouldValidate: true })}
              excludeId={watchedAccountId}
              placeholder="To account"
            />
          </Field>
        </div>
      ) : null}

      {/* ----------------------------------------------------- category */}
      {req.needsCategory ? (
        <Field label="Category" error={errors.categoryId?.message}>
          <Select
            value={watchedCategoryId ?? ""}
            onValueChange={(v) => setValue("categoryId", v, { shouldValidate: true })}
          >
            <SelectTrigger className="min-h-11 w-full" aria-label="Select a category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {kindCategories.map((c) => (
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

      {/* ------------------------------- ledger entry (LENT/BORROWED) */}
      {isLentBorrowed(type) ? (
        <div className="rounded-xl border border-hairline bg-muted/40 p-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={createLedger}
              onCheckedChange={(v) => setCreateLedger(v === true)}
              className="mt-0.5"
              aria-label="Also create a ledger entry to track outstanding"
            />
            <span className="text-[13px] font-medium leading-snug text-ink">
              Also create a ledger entry (track outstanding)
              <span className="mt-0.5 block text-[11.5px] font-normal leading-snug text-ink-soft">
                {createLedger
                  ? "Creates a tracked debt with this person so repayments can be logged against it."
                  : "Records only the cash movement — nothing will be tracked for repayment."}
              </span>
            </span>
          </label>
          {createLedger ? (
            <div className="mt-3">
              <Field label="Due date (optional)" htmlFor="raqamora-txn-due">
                <Input
                  id="raqamora-txn-due"
                  type="date"
                  className="min-h-11"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* --------------------------------------------------- adjustment */}
      {req.needsReason ? (
        <div className="space-y-3">
          <Field label="Direction">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Adjustment direction">
              {(["INCREASE", "DECREASE"] as const).map((d) => {
                const active = adjustDirection === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setValue("adjustDirection", d, { shouldValidate: true })}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? d === "INCREASE"
                          ? "border-brand-emerald bg-brand-emerald/10 text-brand-emerald-deep"
                          : "border-danger-brand bg-danger-brand/10 text-danger-brand"
                        : "border-hairline text-ink-soft hover:text-ink",
                    )}
                  >
                    {d === "INCREASE" ? (
                      <ArrowUpRight className="size-4" aria-hidden />
                    ) : (
                      <ArrowDownRight className="size-4" aria-hidden />
                    )}
                    {d === "INCREASE" ? "Increase balance" : "Decrease balance"}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field
            label="Reason"
            htmlFor="raqamora-txn-reason"
            error={errors.reason?.message}
            hint="Required for adjustments — e.g. “Cash count correction”."
          >
            <Input
              id="raqamora-txn-reason"
              placeholder="e.g. Cash count correction"
              maxLength={500}
              className="min-h-11"
              {...form.register("reason")}
            />
          </Field>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- note */}
      <Field label="Note" htmlFor="raqamora-txn-note">
        <Input
          id="raqamora-txn-note"
          placeholder="Optional note"
          maxLength={500}
          className="min-h-11"
          {...form.register("note")}
        />
      </Field>

      {/* -------------------------------------------------------- submit */}
      <Button type="submit" className="min-h-11 w-full text-[14px]" disabled={submitting}>
        {submitting ? <Spinner className="size-4 text-current" /> : <Check className="size-4" aria-hidden />}
        {submitting ? "Saving…" : "Save transaction"}
      </Button>
    </form>
  );
}
