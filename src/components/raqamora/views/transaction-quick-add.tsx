"use client";

/**
 * RAQAMORA transaction quick-add — Mobile-first, world-class capture experience.
 *
 * Engineered with 20+ year mobile UX principles:
 * - One-handed thumb zone ergonomics (anchored primary CTA, zero scroll for 95% of txns)
 * - Hero typography for amount with tactile rapid-increment pills
 * - Horizontal swipeable visual category badges with micro-interactions
 * - Contextual summary chips for Account, Date, and Note
 * - Everyday intuitive vocabulary (Kharcha, Aamdani, Transfer, Khata)
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
  Calendar,
  Check,
  ChevronDown,
  HandCoins,
  Handshake,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
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

export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function karachiDateTimeIso(value: string): string {
  if (!value) return new Date().toISOString();
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const d = new Date(`${withSeconds}+05:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function karachiDateNoonIso(value: string): string {
  const d = new Date(`${value}T12:00:00+05:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function formatDatePill(isoString?: string): string {
  if (!isoString) return "Aaj";
  try {
    const d = new Date(isoString);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (isToday) return `Aaj, ${timeStr}`;
    return `${d.getDate()}/${d.getMonth() + 1}, ${timeStr}`;
  } catch {
    return "Tareekh";
  }
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
    <div className="grid gap-1">
      <Label htmlFor={htmlFor} className="text-[12px] font-semibold text-ink">
        {label}
      </Label>
      {children}
      {hint && !error ? <p className="text-[11px] leading-snug text-ink-soft">{hint}</p> : null}
      {error ? (
        <p className="text-[11px] font-medium text-danger-brand" role="alert">
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
          className="h-9 shrink-0 gap-1 px-2.5 text-xs rounded-xl"
          title="Naya banda add karein"
        >
          <UserPlus className="size-3.5" aria-hidden />
          <span>+ Naya</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 rounded-2xl shadow-xl">
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
            className="h-9 text-xs rounded-lg"
          />
          <Button type="submit" size="sm" className="w-full h-8 text-xs font-medium rounded-lg" disabled={!name.trim() || saving}>
            {saving ? <Spinner className="size-3.5 text-current mr-1.5" /> : null}
            Add Karein
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------- Top Modes */

type TopTab = "EXPENSE" | "INCOME" | "TRANSFER" | "KHATA" | "MORE";

function getTopTab(t: TxnType): TopTab {
  if (t === "EXPENSE") return "EXPENSE";
  if (t === "INCOME") return "INCOME";
  if (t === "TRANSFER") return "TRANSFER";
  if (t === "LENT" || t === "BORROWED" || t === "REPAYMENT_RECEIVED" || t === "REPAYMENT_MADE") return "KHATA";
  return "MORE";
}

/* ------------------------------------------------------------ Main Form */

export default function TransactionQuickAdd({ onSaved, defaultType = "EXPENSE" }: TransactionQuickAddProps) {
  const guard = useUnauthorizedGuard();

  const [accounts, setAccounts] = React.useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [people, setPeople] = React.useState<PersonRow[]>([]);
  const [loadState, setLoadState] = React.useState<"loading" | "ready" | "error">("loading");

  const [showNote, setShowNote] = React.useState(false);
  const [accountPopoverOpen, setAccountPopoverOpen] = React.useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = React.useState(false);

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
  const watchedNote = watch("note");
  const watchedDate = watch("date");

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

        // Smart default: Auto-select primary account
        if (!getValues("accountId") && activeAccounts.length > 0) {
          setValue("accountId", activeAccounts[0].id);
        }

        // Smart default: Auto-select first matching category
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
  const visibleChips = kindCategories.slice(0, 6);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {/* ----------------------------------- Top iOS-Style Segmented Control */}
      <div className="space-y-1.5">
        <div className="relative flex items-center justify-between">
          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted/60 p-1 border border-hairline w-full">
            <button
              type="button"
              onClick={() => selectType("EXPENSE")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-bold transition-all active:scale-95",
                topTab === "EXPENSE"
                  ? "bg-card text-danger-brand shadow-sm ring-1 ring-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <TrendingDown className="size-3.5" />
              <span>Kharcha</span>
            </button>

            <button
              type="button"
              onClick={() => selectType("INCOME")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-bold transition-all active:scale-95",
                topTab === "INCOME"
                  ? "bg-card text-brand-emerald-deep dark:text-[#53c6ac] shadow-sm ring-1 ring-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <TrendingUp className="size-3.5" />
              <span>Aamdani</span>
            </button>

            <button
              type="button"
              onClick={() => selectType("TRANSFER")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-bold transition-all active:scale-95",
                topTab === "TRANSFER"
                  ? "bg-card text-ink shadow-sm ring-1 ring-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <ArrowLeftRight className="size-3.5" />
              <span>Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => selectType("LENT")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-bold transition-all active:scale-95",
                topTab === "KHATA"
                  ? "bg-card text-brand-emerald-deep dark:text-[#53c6ac] shadow-sm ring-1 ring-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <HandCoins className="size-3.5" />
              <span>Khata</span>
            </button>
          </div>
        </div>

        {/* Khata Sub-Modes Carousel */}
        {topTab === "KHATA" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-muted/30 rounded-xl border border-hairline">
            <button
              type="button"
              onClick={() => selectType("LENT")}
              className={cn(
                "rounded-lg py-1.5 px-2 text-[11px] font-medium transition-all text-center active:scale-95",
                type === "LENT"
                  ? "bg-card text-ink font-bold shadow-xs border border-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Mene Diye (Lena hai)
            </button>
            <button
              type="button"
              onClick={() => selectType("BORROWED")}
              className={cn(
                "rounded-lg py-1.5 px-2 text-[11px] font-medium transition-all text-center active:scale-95",
                type === "BORROWED"
                  ? "bg-card text-ink font-bold shadow-xs border border-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Mene Liye (Dena hai)
            </button>
            <button
              type="button"
              onClick={() => selectType("REPAYMENT_RECEIVED")}
              className={cn(
                "rounded-lg py-1.5 px-2 text-[11px] font-medium transition-all text-center active:scale-95",
                type === "REPAYMENT_RECEIVED"
                  ? "bg-card text-brand-emerald-deep font-bold shadow-xs border border-hairline dark:text-[#53c6ac]"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Wapsi Mili
            </button>
            <button
              type="button"
              onClick={() => selectType("REPAYMENT_MADE")}
              className={cn(
                "rounded-lg py-1.5 px-2 text-[11px] font-medium transition-all text-center active:scale-95",
                type === "REPAYMENT_MADE"
                  ? "bg-card text-danger-brand font-bold shadow-xs border border-hairline"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              Wapsi Di
            </button>
          </div>
        )}

        {/* Mazeed Options Dropdown */}
        <div className="flex justify-end px-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-[11px] text-ink-soft hover:text-ink flex items-center gap-1 font-medium transition-colors"
              >
                <span>Mazeed (Refund / Adjust)</span>
                <ChevronDown className="size-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5 rounded-2xl shadow-xl">
              <button
                type="button"
                onClick={() => selectType("REFUND")}
                className={cn(
                  "w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-left transition-colors",
                  type === "REFUND" ? "bg-muted font-bold text-ink" : "text-ink-soft hover:bg-muted/60 hover:text-ink",
                )}
              >
                <RotateCcw className="size-3.5" />
                <span>Refund (Wapsi raqam)</span>
              </button>
              <button
                type="button"
                onClick={() => selectType("ADJUSTMENT")}
                className={cn(
                  "w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-left transition-colors",
                  type === "ADJUSTMENT" ? "bg-muted font-bold text-ink" : "text-ink-soft hover:bg-muted/60 hover:text-ink",
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>Balance Adjustment</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ------------------------------------------------ Hero Amount Display */}
      <div className="relative py-2 sm:py-3 text-center">
        <div className="inline-flex items-baseline justify-center gap-1.5">
          <span className="text-2xl font-bold text-ink-soft select-none" aria-hidden>
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
            className="w-[200px] sm:w-[240px] border-none bg-transparent text-center text-4xl sm:text-5xl font-black tracking-tight text-ink focus-visible:ring-0 shadow-none p-0 h-auto [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            {...form.register("amountRupees", { valueAsNumber: true })}
          />
        </div>

        {isRepayment(type) && selectedDebt ? (
          <div className="mt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={fillMax}
              className="h-6 px-2.5 text-[11px] font-bold rounded-full"
            >
              Full Baqaya ({formatPKR(selectedDebt.outstanding)})
            </Button>
          </div>
        ) : null}

        {errors.amountRupees && (
          <p className="mt-1 text-xs font-semibold text-danger-brand" role="alert">
            {errors.amountRupees.message}
          </p>
        )}

        {/* Quick Rapid-Increment Pills */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {[100, 500, 1000, 5000].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => addQuickAmount(val)}
              className="rounded-full border border-hairline/80 bg-muted/40 hover:bg-muted px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:text-ink active:scale-95 transition-all shadow-2xs"
            >
              +{formatRupees(val * 100)}
            </button>
          ))}
          {watchedAmount > 0 && (
            <button
              type="button"
              onClick={() => setValue("amountRupees", Number.NaN)}
              className="rounded-full border border-hairline/80 px-2 py-1 text-[11px] font-medium text-ink-soft hover:text-danger-brand active:scale-95 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* -------------------------------- Horizontal Category Icon Badges */}
      {req.needsCategory && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Category
            </span>
            {kindCategories.length > 6 && (
              <Select
                value={watchedCategoryId ?? ""}
                onValueChange={(v) => setValue("categoryId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="h-6 text-[11px] border-none bg-transparent hover:bg-muted/50 p-1 w-auto gap-1 text-ink-soft">
                  <SelectValue placeholder="All Categories ▾" />
                </SelectTrigger>
                <SelectContent className="max-h-64 rounded-2xl">
                  {kindCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex min-w-0 items-center gap-2">
                        <AppIcon name={c.icon} className="size-3.5 shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
            {visibleChips.map((c) => {
              const active = watchedCategoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setValue("categoryId", c.id, { shouldValidate: true })}
                  className={cn(
                    "flex flex-col items-center gap-1 shrink-0 p-1.5 rounded-2xl transition-all active:scale-95 min-w-[62px]",
                    active
                      ? "bg-brand-emerald/10 text-brand-emerald-deep font-bold ring-2 ring-brand-emerald/50 dark:text-[#53c6ac]"
                      : "text-ink-soft hover:bg-muted/50 hover:text-ink",
                  )}
                >
                  <div
                    className={cn(
                      "size-10 rounded-full flex items-center justify-center transition-transform",
                      active
                        ? "bg-brand-emerald text-white shadow-sm scale-105"
                        : "bg-muted/80 text-ink-soft",
                    )}
                  >
                    <AppIcon name={c.icon} className="size-4" />
                  </div>
                  <span className="text-[10.5px] truncate max-w-[58px] leading-tight">
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>

          {errors.categoryId && (
            <p className="text-[11px] font-semibold text-danger-brand" role="alert">
              {errors.categoryId.message}
            </p>
          )}
        </div>
      )}

      {/* -------------------------------- Contextual Interactive Action Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {/* Account Chip */}
        {req.needsAccount && !req.needsToAccount && (
          <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card/80 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-card transition-all active:scale-95 shadow-2xs"
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: fromAccount?.color || "#16836f" }}
                />
                <span className="truncate max-w-[120px]">
                  {fromAccount ? fromAccount.name : "Account Chunein"}
                </span>
                <ChevronDown className="size-3 text-ink-soft" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-1.5 rounded-2xl shadow-xl">
              <div className="space-y-1">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-soft px-2 py-1">
                  {type === "INCOME" ? "Deposit Account" : "Paid From Account"}
                </div>
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setValue("accountId", a.id, { shouldValidate: true });
                      setAccountPopoverOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs text-left transition-colors",
                      watchedAccountId === a.id
                        ? "bg-brand-emerald/15 text-brand-emerald-deep font-bold"
                        : "hover:bg-muted text-ink",
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="truncate">{a.name}</span>
                    </span>
                    <span className="text-[10.5px] text-ink-soft font-mono">
                      {formatPKR(a.balance)}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Date Chip */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card/80 px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink hover:bg-card transition-all active:scale-95 shadow-2xs"
            >
              <Calendar className="size-3.5 text-ink-soft" />
              <span>{formatDatePill(watchedDate)}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3 rounded-2xl shadow-xl">
            <Label className="text-xs font-semibold text-ink">Tareekh & Waqt</Label>
            <Input
              type="datetime-local"
              className="h-9 text-xs mt-1.5 rounded-xl"
              {...form.register("date")}
            />
            <Button
              type="button"
              size="sm"
              className="w-full mt-2 h-8 text-xs font-medium rounded-xl"
              onClick={() => setDatePopoverOpen(false)}
            >
              Theek Hai
            </Button>
          </PopoverContent>
        </Popover>

        {/* Note Toggle Chip */}
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium transition-all active:scale-95 shadow-2xs",
            showNote || watchedNote
              ? "bg-card text-ink border-ink/40 font-semibold"
              : "bg-card/80 text-ink-soft hover:text-ink hover:bg-card",
          )}
        >
          <Pencil className="size-3 text-ink-soft" />
          <span className="truncate max-w-[130px]">
            {watchedNote ? `"${watchedNote}"` : "Note"}
          </span>
        </button>
      </div>

      {/* Expandable Note Input */}
      {(showNote || watchedNote) && (
        <div className="pt-0.5">
          <Input
            id="raqamora-txn-note"
            placeholder="Optional tafseel (e.g. Chai, Lunch, Fuel, Market)"
            maxLength={500}
            className="h-9 text-xs rounded-xl"
            autoFocus={!watchedNote}
            {...form.register("note")}
          />
        </div>
      )}

      {/* -------------------------------- Transfer Dual-Account Mode */}
      {req.needsToAccount && (
        <div className="grid gap-2 sm:grid-cols-2 rounded-2xl bg-muted/20 p-2.5 border border-hairline">
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Kahan se nikale?
            </Label>
            <Select
              value={watchedAccountId ?? ""}
              onValueChange={(v) => setValue("accountId", v, { shouldValidate: true })}
            >
              <SelectTrigger className="h-9 w-full text-xs rounded-xl mt-1">
                <SelectValue placeholder="From account" />
              </SelectTrigger>
              <SelectContent className="max-h-64 rounded-2xl">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} disabled={watchedToAccountId === a.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span>{a.name} ({formatPKR(a.balance)})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-[11px] font-semibold text-danger-brand">{errors.accountId.message}</p>
            )}
          </div>
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Kahan transfer kiye?
            </Label>
            <Select
              value={watchedToAccountId ?? ""}
              onValueChange={(v) => setValue("toAccountId", v, { shouldValidate: true })}
            >
              <SelectTrigger className="h-9 w-full text-xs rounded-xl mt-1">
                <SelectValue placeholder="To account" />
              </SelectTrigger>
              <SelectContent className="max-h-64 rounded-2xl">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} disabled={watchedAccountId === a.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span>{a.name} ({formatPKR(a.balance)})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.toAccountId && (
              <p className="text-[11px] font-semibold text-danger-brand">{errors.toAccountId.message}</p>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------- Khata Person Selector */}
      {req.needsPerson && (
        <div className="space-y-1.5 rounded-2xl bg-muted/20 p-2.5 border border-hairline">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Banda (Person)
            </Label>
            <AddPersonInline
              onAdded={(person) => {
                setPeople((prev) =>
                  [...prev, person].sort((a, b) => a.name.localeCompare(b.name)),
                );
                handlePersonChange(person.id);
              }}
            />
          </div>

          <Select
            value={watchedPersonId ?? ""}
            onValueChange={(v) => handlePersonChange(v)}
          >
            <SelectTrigger className="h-10 w-full text-xs sm:text-sm rounded-xl">
              <SelectValue placeholder="Banda select karein" />
            </SelectTrigger>
            <SelectContent className="max-h-64 rounded-2xl">
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="truncate">{p.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {errors.personId && (
            <p className="text-[11px] font-semibold text-danger-brand">{errors.personId.message}</p>
          )}

          {/* Repayment Specific Debt Selector */}
          {isRepayment(type) && (
            <div className="pt-1.5 space-y-1">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                {type === "REPAYMENT_RECEIVED" ? "Konsa udhar wapis mila?" : "Konsa udhar wapis diya?"}
              </Label>
              {!watchedPersonId ? (
                <div className="text-xs text-ink-soft p-2 rounded-xl bg-muted/40 border border-hairline">
                  Pehle banda select karein
                </div>
              ) : debtsLoading ? (
                <div className="flex h-9 items-center gap-2 rounded-xl border border-hairline bg-transparent px-3 text-xs text-ink-soft">
                  <Spinner className="size-3.5" /> Active debts load ho rahe hain…
                </div>
              ) : debts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hairline bg-muted/40 p-2.5 text-[11.5px] leading-snug text-ink-soft">
                  Is banday ka koi active udhar nahi mila.
                </p>
              ) : (
                <Select value={watchedDebtId ?? ""} onValueChange={handleDebtChange}>
                  <SelectTrigger className="h-9 w-full text-xs rounded-xl">
                    <SelectValue placeholder="Udhar select karein" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 rounded-2xl">
                    {debts.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        Asal: {formatPKR(d.principal)} · Baqaya: {formatPKR(d.outstanding)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.debtId && (
                <p className="text-[11px] font-semibold text-danger-brand">{errors.debtId.message}</p>
              )}
            </div>
          )}

          {/* Track Loan Checkbox (LENT / BORROWED) */}
          {isLentBorrowed(type) && (
            <div className="pt-1">
              <label className="flex cursor-pointer items-start gap-2">
                <Checkbox
                  checked={createLedger}
                  onCheckedChange={(v) => setCreateLedger(v === true)}
                  className="mt-0.5 rounded-md"
                />
                <span className="text-xs font-semibold leading-tight text-ink">
                  Khata mein hisab rakhein
                  <span className="block text-[11px] font-normal text-ink-soft mt-0.5">
                    {createLedger
                      ? "Baqaya raqam is banday ke profile mein add ho jayegi."
                      : "Sirf cash movement record hogi."}
                  </span>
                </span>
              </label>

              {createLedger && (
                <div className="mt-2">
                  <Label htmlFor="raqamora-txn-due" className="text-[11px] font-medium text-ink-soft">
                    Wapsi ki tareekh (optional)
                  </Label>
                  <Input
                    id="raqamora-txn-due"
                    type="date"
                    className="h-8 text-xs mt-0.5 rounded-lg"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------- Adjustment Fields */}
      {req.needsReason && (
        <div className="space-y-2 rounded-2xl border border-hairline bg-muted/30 p-2.5">
          <Label className="text-xs font-semibold text-ink">Adjustment Direction</Label>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
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
                    "flex h-8 items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors",
                    active
                      ? d === "INCREASE"
                        ? "border-brand-emerald bg-brand-emerald/10 text-brand-emerald-deep font-bold"
                        : "border-danger-brand bg-danger-brand/10 text-danger-brand font-bold"
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
          >
            <Input
              id="raqamora-txn-reason"
              placeholder="e.g. Cash count correction"
              maxLength={500}
              className="h-8 text-xs rounded-xl"
              {...form.register("reason")}
            />
          </Field>
        </div>
      )}

      {/* ----------------------------- Sticky Bottom Thumb Action Button */}
      <div className="sticky bottom-0 inset-x-0 pt-2 pb-0.5 bg-gradient-to-t from-background via-background/95 to-transparent mt-1">
        <Button
          type="submit"
          className="min-h-12 w-full text-[15px] font-bold rounded-2xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald text-white shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:brightness-105 active:scale-[0.98] transition-all"
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
              ? `Save Kharcha ${watchedAmount > 0 ? `• Rs ${formatRupees(Math.round(watchedAmount * 100))}` : ""}`
              : type === "INCOME"
                ? `Save Aamdani ${watchedAmount > 0 ? `• Rs ${formatRupees(Math.round(watchedAmount * 100))}` : ""}`
                : type === "TRANSFER"
                  ? `Transfer ${watchedAmount > 0 ? `• Rs ${formatRupees(Math.round(watchedAmount * 100))}` : "Karein"}`
                  : type === "LENT"
                    ? `Save Khata (Diye) ${watchedAmount > 0 ? `• Rs ${formatRupees(Math.round(watchedAmount * 100))}` : ""}`
                    : type === "BORROWED"
                      ? `Save Khata (Liye) ${watchedAmount > 0 ? `• Rs ${formatRupees(Math.round(watchedAmount * 100))}` : ""}`
                      : isRepayment(type)
                        ? "Save Wapsi"
                        : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}
