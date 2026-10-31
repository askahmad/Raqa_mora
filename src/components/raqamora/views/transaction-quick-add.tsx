"use client";

/**
 * RAQAMORA transaction quick-add — fast, frictionless & beginner-friendly capture.
 *
 * Designed with simple everyday language (Kharcha, Aamdani, Transfer, Khata)
 * and smart defaults so users can log an entry in under 3 seconds.
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
  ChevronDown,
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
      <Label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-ink">
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

function isRepayment(t: TxnType): boolean {
  return t === "REPAYMENT_RECEIVED" || t === "REPAYMENT_MADE";
}

function isLentBorrowed(t: TxnType): boolean {
  return t === "LENT" || t === "BORROWED";
}

/* ------------------------------------------------------------ props/types */

export type TransactionQuickAddProps = {
  onSaved: () => void;
  defaultType?: TxnType;
};

/* -------------------------------------------------------- AddPersonInline */

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
      toast.success(`${person.name} add ho gaye`);
      onAdded(person);
      setOpen(false);
      setName("");
    } catch (err) {
      if (!guard(err)) {
        toast.error(err instanceof Error ? err.message : "Banda add nahi ho saka");
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
          className="h-10 shrink-0 gap-1.5 px-3 text-xs"
          title="Naya banda add karein"
        >
          <UserPlus className="size-3.5" aria-hidden />
          <span>+ Naya</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-2.5"
        >
          <Label htmlFor="raqamora-new-person" className="text-xs font-semibold text-ink">
            Naya Banda (Person)
          </Label>
          <Input
            id="raqamora-new-person"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam likhein (e.g. Ali Khan)"
            maxLength={80}
            autoFocus
            className="h-9 text-xs"
          />
          <Button type="submit" size="sm" className="w-full h-8 text-xs font-medium" disabled={!name.trim() || saving}>
            {saving ? <Spinner className="size-3.5 text-current mr-1.5" /> : null}
            Add Karein
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------- AccountSelect */

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
      <SelectTrigger className="h-10 w-full text-xs sm:text-sm" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id} disabled={excludeId === a.id}>
            <span className="flex min-w-0 items-center justify-between gap-3 w-full">
              <span className="flex items-center gap-2 truncate">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden
                />
                <span className="truncate">{a.name}</span>
              </span>
              <span className="text-[11px] text-ink-soft shrink-0 font-mono">
                {formatPKR(a.balance)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------ Main Form */

type TopTab = "EXPENSE" | "INCOME" | "TRANSFER" | "KHATA" | "MORE";

function getTopTab(t: TxnType): TopTab {
  if (t === "EXPENSE") return "EXPENSE";
  if (t === "INCOME") return "INCOME";
  if (t === "TRANSFER") return "TRANSFER";
  if (t === "LENT" || t === "BORROWED" || t === "REPAYMENT_RECEIVED" || t === "REPAYMENT_MADE") return "KHATA";
  return "MORE";
}

export default function TransactionQuickAdd({ onSaved, defaultType = "EXPENSE" }: TransactionQuickAddProps) {
  const guard = useUnauthorizedGuard();

  const [accounts, setAccounts] = React.useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [people, setPeople] = React.useState<PersonRow[]>([]);
  const [loadState, setLoadState] = React.useState<"loading" | "ready" | "error">("loading");

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

  const { setValue, getValues, watch } = form;
  const errors = form.formState.errors;

  const type = watch("type");
  const req = txnFieldRequirements(type);
  const watchedPersonId = watch("personId");
  const watchedDebtId = watch("debtId");
  const watchedAccountId = watch("accountId");
  const watchedToAccountId = watch("toAccountId");
  const watchedCategoryId = watch("categoryId");
  const adjustDirection = watch("adjustDirection");
  const watchedAmount = watch("amountRupees");

  const [createLedger, setCreateLedger] = React.useState(true);
  const [dueDate, setDueDate] = React.useState("");

  const [debts, setDebts] = React.useState<DebtWithOutstanding[]>([]);
  const [debtsLoading, setDebtsLoading] = React.useState(false);
  const debtReqRef = React.useRef(0);

  const loadBase = React.useCallback(() => {
    setLoadState("loading");
    Promise.all([
      apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts"),
      apiGet<{ categories: CategoryRow[] }>("/api/categories"),
      apiGet<{ people: PersonRow[] }>("/api/people"),
    ])
      .then(([a, c, p]) => {
        const activeAccounts = a.accounts.filter((acc) => !acc.archived);
        const activeCategories = c.categories.filter((cat) => !cat.archived);
        setAccounts(activeAccounts);
        setCategories(activeCategories);
        setPeople(p.people);

        // Smart default 1: Auto-select primary/first account
        if (!getValues("accountId") && activeAccounts.length > 0) {
          setValue("accountId", activeAccounts[0].id);
        }

        // Smart default 2: Auto-select first matching category
        const initialKind = defaultType === "INCOME" ? "INCOME" : "EXPENSE";
        const firstCat = activeCategories.find((cat) => cat.kind === initialKind);
        if (!getValues("categoryId") && firstCat) {
          setValue("categoryId", firstCat.id);
        }

        setLoadState("ready");
      })
      .catch((err) => {
        if (guard(err)) return;
        setLoadState("error");
      });
  }, [guard, defaultType, getValues, setValue]);

  React.useEffect(() => {
    loadBase();
  }, [loadBase]);

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
          if (!guard(err)) toast.error("Active debts load nahi ho sake");
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

    if (!nextReq.needsToAccount) {
      setValue("toAccountId", null);
    } else {
      // Smart default for transfer: pick a different account
      const currentFrom = getValues("accountId");
      const other = accounts.find((a) => a.id !== currentFrom);
      if (other && !getValues("toAccountId")) {
        setValue("toAccountId", other.id);
      }
    }

    if (!nextReq.needsPerson) setValue("personId", null);
    setValue("debtId", null);
    setDebts([]);

    if (!nextReq.needsCategory) {
      setValue("categoryId", null);
    } else {
      const current = categories.find((c) => c.id === getValues("categoryId"));
      const wantKind = next === "INCOME" ? "INCOME" : "EXPENSE";
      if (!current || current.kind !== wantKind) {
        const firstMatch = categories.find((c) => c.kind === wantKind);
        setValue("categoryId", firstMatch ? firstMatch.id : null);
      }
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
    const current = form.getValues("amountRupees");
    if (debt && (current === undefined || current === null || Number.isNaN(current) || current === 0)) {
      setValue("amountRupees", debt.outstanding / 100, { shouldValidate: true });
    }
  }

  function fillMax() {
    if (!selectedDebt) return;
    setValue("amountRupees", selectedDebt.outstanding / 100, { shouldValidate: true });
  }

  function addQuickAmount(delta: number) {
    const curr = form.getValues("amountRupees");
    const base = Number.isNaN(curr) || !curr ? 0 : curr;
    setValue("amountRupees", base + delta, { shouldValidate: true });
  }

  /* ---- submit ---- */
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    const t = values.type;
    const paisa = Math.round(values.amountRupees * 100);

    if (isRepayment(t)) {
      if (!values.debtId) {
        form.setError("debtId", { message: "Konsa udhar wapis mila/diya hai, select karein" });
        return;
      }
      if (selectedDebt && paisa > selectedDebt.outstanding) {
        form.setError("amountRupees", {
          message: `Baqaya raqam Rs ${formatRupees(selectedDebt.outstanding)} se ziada nahi ho sakti`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isLentBorrowed(t) && createLedger) {
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
            ? `${formatPKR(paisa)} diye — Khata record ho gaya`
            : `${formatPKR(paisa)} liye — Khata record ho gaya`,
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
        toast.success(
          t === "EXPENSE"
            ? `Kharcha ${formatPKR(paisa)} save ho gaya`
            : t === "INCOME"
              ? `Aamdani ${formatPKR(paisa)} save ho gayi`
              : `${TXN_TYPE_LABELS[t]} (${formatPKR(paisa)}) save ho gaya`,
        );
      }
      onSaved();
    } catch (err) {
      if (guard(err)) return;
      toast.error(err instanceof Error ? err.message : "Save nahi ho saka, dobara koshish karein");
    } finally {
      setSubmitting(false);
    }
  });

  if (loadState === "loading") {
    return <SkeletonList rows={4} />;
  }
  if (loadState === "error") {
    return (
      <EmptyState
        title="Accounts aur Categories load nahi huye"
        description="Apna internet connection check karein."
        actionLabel="Dobara Koshish Karein"
        onAction={() => loadBase()}
      />
    );
  }
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Koi Account nahi mila"
        description="Entry karne ke liye pehle Accounts page par ja kar ek account (e.g. Cash ya Bank) banayein."
      />
    );
  }

  const topTab = getTopTab(type);
  const categoryKind = type === "INCOME" ? "INCOME" : "EXPENSE";
  const kindCategories = categories.filter((c) => c.kind === categoryKind);
  const visibleChips = kindCategories.slice(0, 5);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3.5">
      {/* ------------------------------------------------ Top Primary Tabs */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1 border border-hairline">
          <button
            type="button"
            onClick={() => selectType("EXPENSE")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg py-2 px-1 text-xs font-semibold transition-all",
              topTab === "EXPENSE"
                ? "bg-card text-danger-brand shadow-xs ring-1 ring-hairline"
                : "text-ink-soft hover:text-ink hover:bg-card/50",
            )}
          >
            <TrendingDown className="size-3.5" />
            <span>Kharcha</span>
          </button>

          <button
            type="button"
            onClick={() => selectType("INCOME")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg py-2 px-1 text-xs font-semibold transition-all",
              topTab === "INCOME"
                ? "bg-card text-brand-emerald-deep dark:text-[#53c6ac] shadow-xs ring-1 ring-hairline"
                : "text-ink-soft hover:text-ink hover:bg-card/50",
            )}
          >
            <TrendingUp className="size-3.5" />
            <span>Aamdani</span>
          </button>

          <button
            type="button"
            onClick={() => selectType("TRANSFER")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg py-2 px-1 text-xs font-semibold transition-all",
              topTab === "TRANSFER"
                ? "bg-card text-ink shadow-xs ring-1 ring-hairline"
                : "text-ink-soft hover:text-ink hover:bg-card/50",
            )}
          >
            <ArrowLeftRight className="size-3.5" />
            <span>Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => selectType("LENT")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg py-2 px-1 text-xs font-semibold transition-all",
              topTab === "KHATA"
                ? "bg-card text-brand-emerald-deep dark:text-[#53c6ac] shadow-xs ring-1 ring-hairline"
                : "text-ink-soft hover:text-ink hover:bg-card/50",
            )}
          >
            <HandCoins className="size-3.5" />
            <span>Khata</span>
          </button>
        </div>

        {/* Khata Sub-modes */}
        {topTab === "KHATA" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-muted/30 rounded-lg border border-hairline">
            <button
              type="button"
              onClick={() => selectType("LENT")}
              className={cn(
                "rounded-md py-1.5 px-2 text-[11px] font-medium transition-all text-center",
                type === "LENT"
                  ? "bg-card text-ink font-semibold shadow-xs border border-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Mene Diye (Lena hai)
            </button>
            <button
              type="button"
              onClick={() => selectType("BORROWED")}
              className={cn(
                "rounded-md py-1.5 px-2 text-[11px] font-medium transition-all text-center",
                type === "BORROWED"
                  ? "bg-card text-ink font-semibold shadow-xs border border-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Mene Liye (Dena hai)
            </button>
            <button
              type="button"
              onClick={() => selectType("REPAYMENT_RECEIVED")}
              className={cn(
                "rounded-md py-1.5 px-2 text-[11px] font-medium transition-all text-center",
                type === "REPAYMENT_RECEIVED"
                  ? "bg-card text-brand-emerald-deep font-semibold shadow-xs border border-hairline dark:text-[#53c6ac]"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Wapsi Mili
            </button>
            <button
              type="button"
              onClick={() => selectType("REPAYMENT_MADE")}
              className={cn(
                "rounded-md py-1.5 px-2 text-[11px] font-medium transition-all text-center",
                type === "REPAYMENT_MADE"
                  ? "bg-card text-danger-brand font-semibold shadow-xs border border-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Wapsi Di
            </button>
          </div>
        )}

        {/* More Options Link */}
        <div className="flex justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-[11px] text-ink-soft hover:text-ink flex items-center gap-1 font-medium transition-colors"
              >
                <span>Mazeed Options (Refund / Adjustment)</span>
                <ChevronDown className="size-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5 space-y-1">
              <button
                type="button"
                onClick={() => selectType("REFUND")}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-left transition-colors",
                  type === "REFUND" ? "bg-muted font-semibold text-ink" : "text-ink-soft hover:bg-muted/60 hover:text-ink",
                )}
              >
                <RotateCcw className="size-3.5" />
                <span>Refund (Wapsi raqam)</span>
              </button>
              <button
                type="button"
                onClick={() => selectType("ADJUSTMENT")}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-left transition-colors",
                  type === "ADJUSTMENT" ? "bg-muted font-semibold text-ink" : "text-ink-soft hover:bg-muted/60 hover:text-ink",
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>Balance Adjustment</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ------------------------------------------------ Hero Amount Input */}
      <div className="rounded-2xl border border-hairline bg-card/70 p-3 sm:p-4 text-center">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-ink-soft">
          {type === "INCOME"
            ? "Aamdani Raqam"
            : type === "TRANSFER"
              ? "Transfer Raqam"
              : isLentBorrowed(type)
                ? "Khata Raqam"
                : "Kharcha Raqam"}
        </span>
        <div className="relative mt-1 flex items-center justify-center">
          <span className="text-xl sm:text-2xl font-bold text-ink-soft mr-2" aria-hidden>
            Rs
          </span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0"
            autoFocus
            aria-label="Amount in rupees"
            className="h-12 w-full max-w-[280px] border-none bg-transparent text-center text-3xl sm:text-4xl font-extrabold tracking-tight text-ink focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            {...form.register("amountRupees", { valueAsNumber: true })}
          />
          {isRepayment(type) && selectedDebt ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={fillMax}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-7 px-2 text-[11px] font-semibold"
            >
              Full Baqaya
            </Button>
          ) : null}
        </div>

        {errors.amountRupees && (
          <p className="mt-1 text-xs font-medium text-danger-brand" role="alert">
            {errors.amountRupees.message}
          </p>
        )}

        {/* Quick Amount Booster Chips */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
          {[100, 500, 1000, 5000].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => addQuickAmount(val)}
              className="rounded-full border border-hairline bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-muted hover:text-ink active:scale-95 transition-all"
            >
              +{formatRupees(val * 100)}
            </button>
          ))}
          {watchedAmount > 0 && (
            <button
              type="button"
              onClick={() => setValue("amountRupees", Number.NaN)}
              className="rounded-full border border-hairline px-2 py-1 text-[11px] text-ink-soft hover:text-danger-brand transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ Category Chips */}
      {req.needsCategory && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-ink">
              Category {type === "INCOME" ? "(Kahan se aayi?)" : "(Kahan kharch huye?)"}
            </Label>
            {kindCategories.length > 5 && (
              <Select
                value={watchedCategoryId ?? ""}
                onValueChange={(v) => setValue("categoryId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="h-7 text-[11px] border-dashed text-ink-soft px-2 w-auto gap-1">
                  <SelectValue placeholder="All Categories" />
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
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {visibleChips.map((c) => {
              const active = watchedCategoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setValue("categoryId", c.id, { shouldValidate: true })}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-95",
                    active
                      ? "border-brand-emerald bg-brand-emerald/15 text-brand-emerald-deep font-semibold dark:text-[#53c6ac] ring-1 ring-brand-emerald shadow-xs"
                      : "border-hairline bg-card text-ink-soft hover:border-brand-emerald/40 hover:text-ink",
                  )}
                >
                  <AppIcon name={c.icon} className="size-3.5 shrink-0" />
                  <span className="truncate max-w-[100px]">{c.name}</span>
                </button>
              );
            })}
          </div>

          {errors.categoryId && (
            <p className="text-[11.5px] font-medium text-danger-brand" role="alert">
              {errors.categoryId.message}
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------ Account Selection */}
      {req.needsAccount && !req.needsToAccount && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-ink">
              {type === "INCOME" || type === "BORROWED" || type === "REPAYMENT_RECEIVED" || type === "REFUND"
                ? "Deposit to (Kahan jama huye?)"
                : "Paid from (Kahan se diye?)"}
            </Label>
            {fromAccount && (
              <span className="text-[11px] text-ink-soft font-mono">
                Balance: {formatPKR(fromAccount.balance)}
              </span>
            )}
          </div>
          <AccountSelect
            accounts={accounts}
            value={watchedAccountId}
            onChange={(v) => setValue("accountId", v, { shouldValidate: true })}
            placeholder="Account chunein"
          />
          {errors.accountId && (
            <p className="text-[11.5px] font-medium text-danger-brand" role="alert">
              {errors.accountId.message}
            </p>
          )}
        </div>
      )}

      {/* Transfer Accounts */}
      {req.needsToAccount && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-ink">Kahan se nikale?</Label>
            <AccountSelect
              accounts={accounts}
              value={watchedAccountId}
              onChange={(v) => setValue("accountId", v, { shouldValidate: true })}
              excludeId={watchedToAccountId}
              placeholder="Source account"
            />
            {errors.accountId && (
              <p className="text-[11.5px] font-medium text-danger-brand">{errors.accountId.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-ink">Kahan transfer kiye?</Label>
            <AccountSelect
              accounts={accounts}
              value={watchedToAccountId}
              onChange={(v) => setValue("toAccountId", v, { shouldValidate: true })}
              excludeId={watchedAccountId}
              placeholder="Destination account"
            />
            {errors.toAccountId && (
              <p className="text-[11.5px] font-medium text-danger-brand">{errors.toAccountId.message}</p>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Person (Khata) */}
      {req.needsPerson && (
        <Field
          label="Banda (Person)"
          error={errors.personId?.message}
          hint={
            isRepayment(type)
              ? "Wapsi is banday ke baqaya hisab mein se cut hogi."
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={watchedPersonId ?? ""}
                onValueChange={(v) => handlePersonChange(v)}
              >
                <SelectTrigger className="h-10 w-full text-xs sm:text-sm" aria-label="Banda chunein">
                  <SelectValue placeholder="Banda chunein (Select person)" />
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
      )}

      {/* Repayment Debt Select */}
      {isRepayment(type) && (
        <Field
          label={type === "REPAYMENT_RECEIVED" ? "Konsa udhar wapis mila?" : "Konsa udhar wapis diya?"}
          error={errors.debtId?.message}
          hint={
            selectedDebt
              ? `Baqaya ${formatPKR(selectedDebt.outstanding)} (Total: ${formatPKR(selectedDebt.principal)})`
              : undefined
          }
        >
          {!watchedPersonId ? (
            <Select disabled>
              <SelectTrigger className="h-10 w-full text-xs">
                <SelectValue placeholder="Pehle banda select karein" />
              </SelectTrigger>
            </Select>
          ) : debtsLoading ? (
            <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-xs text-ink-soft">
              <Spinner className="size-3.5" /> Active udhar load ho rahe hain…
            </div>
          ) : debts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline bg-muted/40 px-3 py-2 text-[12px] leading-snug text-ink-soft">
              Is banday ka koi active udhar nahi mila.
            </p>
          ) : (
            <Select value={watchedDebtId ?? ""} onValueChange={handleDebtChange}>
              <SelectTrigger className="h-10 w-full text-xs" aria-label="Select debt">
                <SelectValue placeholder="Udhar select karein" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {debts.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    Asal: {formatPKR(d.principal)} · Baqaya: {formatPKR(d.outstanding)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}

      {/* Ledger Checkbox (LENT / BORROWED) */}
      {isLentBorrowed(type) && (
        <div className="rounded-xl border border-hairline bg-muted/40 p-3 space-y-2.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={createLedger}
              onCheckedChange={(v) => setCreateLedger(v === true)}
              className="mt-0.5"
            />
            <span className="text-[12.5px] font-semibold leading-snug text-ink">
              Khata mein record karein (Track loan)
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-ink-soft">
                {createLedger
                  ? "Baqaya raqam is banday ke profile mein add ho jayegi taake wapsi track ho sakay."
                  : "Sirf cash movement record hogi — khata mein baqaya hisab nahi banega."}
              </span>
            </span>
          </label>
          {createLedger && (
            <div className="pt-1">
              <Label htmlFor="raqamora-txn-due" className="text-[11.5px] font-medium text-ink-soft">
                Wapsi ki tareekh (Due date - optional)
              </Label>
              <Input
                id="raqamora-txn-due"
                type="date"
                className="h-9 text-xs mt-1"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Adjustment Fields */}
      {req.needsReason && (
        <div className="space-y-2.5 rounded-xl border border-hairline bg-muted/30 p-3">
          <Label className="text-xs font-semibold text-ink">Adjustment Direction</Label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
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
                    "flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors",
                    active
                      ? d === "INCREASE"
                        ? "border-brand-emerald bg-brand-emerald/10 text-brand-emerald-deep font-semibold"
                        : "border-danger-brand bg-danger-brand/10 text-danger-brand font-semibold"
                      : "border-hairline text-ink-soft hover:text-ink",
                  )}
                >
                  {d === "INCREASE" ? (
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden />
                  )}
                  {d === "INCREASE" ? "Balance Barhayein" : "Balance Kam Karein"}
                </button>
              );
            })}
          </div>
          <Field
            label="Wajah (Reason)"
            htmlFor="raqamora-txn-reason"
            error={errors.reason?.message}
            hint="Adjustment ke liye wajah likhna zaroori hai (e.g. Cash count correction)."
          >
            <Input
              id="raqamora-txn-reason"
              placeholder="e.g. Cash count correction"
              maxLength={500}
              className="h-9 text-xs"
              {...form.register("reason")}
            />
          </Field>
        </div>
      )}

      {/* ------------------------------------------------ Compact Date & Note */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-hairline bg-muted/20 p-2.5">
        <div>
          <Label htmlFor="raqamora-txn-date" className="text-[11px] font-medium text-ink-soft">
            Tareekh (Date & Time)
          </Label>
          <Input
            id="raqamora-txn-date"
            type="datetime-local"
            className="h-8 text-xs mt-0.5"
            {...form.register("date")}
          />
        </div>
        <div>
          <Label htmlFor="raqamora-txn-note" className="text-[11px] font-medium text-ink-soft">
            Note (Optional tafseel)
          </Label>
          <Input
            id="raqamora-txn-note"
            placeholder="e.g. Chai, Lunch, Fuel"
            maxLength={500}
            className="h-8 text-xs mt-0.5"
            {...form.register("note")}
          />
        </div>
      </div>

      {/* ------------------------------------------------ Submit Button */}
      <div className="pt-1">
        <Button
          type="submit"
          className="min-h-11 w-full text-[14px] font-semibold transition-all shadow-sm"
          disabled={submitting}
        >
          {submitting ? (
            <Spinner className="size-4 text-current mr-2" />
          ) : (
            <Check className="size-4 mr-2" aria-hidden />
          )}
          {submitting
            ? "Save ho raha hai…"
            : type === "EXPENSE"
              ? "Save Kharcha"
              : type === "INCOME"
                ? "Save Aamdani"
                : type === "TRANSFER"
                  ? "Transfer Karein"
                  : type === "LENT"
                    ? "Save Khata (Diye)"
                    : type === "BORROWED"
                      ? "Save Khata (Liye)"
                      : isRepayment(type)
                        ? "Save Wapsi"
                        : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}
