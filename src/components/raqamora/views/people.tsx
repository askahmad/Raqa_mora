"use client";

/**
 * RAQAMORA People view — the digital khata. A searchable person list plus a
 * full person-wise ledger detail (position cards, debt entries with repayment
 * history, complete activity timeline and a printable/exportable statement).
 *
 * This module also hosts the shared DebtDialog / RepaymentDialog /
 * DebtEditDialog / PersonDialog and small helpers reused by the Debts view.
 */
import * as React from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Download,
  Ellipsis,
  HandCoins,
  Pencil,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiSend, qs } from "@/lib/raqamora/client";
import { formatPKR, parseRupeesToPaisa } from "@/lib/raqamora/money";
import { personSchema } from "@/lib/raqamora/validation";
import type { AccountWithBalance, DebtWithOutstanding, PersonRow, TxnRow } from "@/lib/raqamora/types";
import { useApp } from "@/components/raqamora/app-root";
import {
  ConfirmDialog,
  EmptyState,
  Money,
  PageHeader,
  SectionCard,
  SkeletonList,
  Spinner,
  TypeBadge,
} from "@/components/raqamora/kit";
import type { ViewProps } from "@/components/raqamora/view-props";
import { AccountIcon } from "@/components/raqamora/icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ consts */

/** Cross-view handoff: Debts view stores a person id here before switching. */
export const SELECTED_PERSON_KEY = "raqamora:selected-person";

const KARACHI_TZ = "Asia/Karachi";

const PRINT_CSS =
  "@media print{body *{visibility:hidden!important}.print-area,.print-area *{visibility:visible!important}" +
  ".print-area{position:absolute!important;left:0;top:0;width:100%;padding:0!important;border:0!important;box-shadow:none!important}" +
  ".no-print{display:none!important}}";

const SCROLL_CSS =
  ".rq-scroll{scrollbar-width:thin;scrollbar-color:var(--border) transparent}" +
  ".rq-scroll::-webkit-scrollbar{width:6px;height:6px}" +
  ".rq-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px}";

const AVATAR_TONES = [
  "bg-brand-emerald/15 text-brand-emerald-deep dark:bg-brand-emerald/25 dark:text-[#53c6ac]",
  "bg-gold/25 text-gold-deep dark:bg-gold/25 dark:text-[#dcc494]",
  "bg-navy/10 text-navy dark:bg-navy/40 dark:text-[#e9edf3]",
  "bg-warn-brand/15 text-[#7c5d1d] dark:bg-warn-brand/25 dark:text-[#d9b25f]",
  "bg-danger-brand/10 text-danger-brand dark:bg-danger-brand/20 dark:text-[#e08a7f]",
  "bg-[#8a6d3b]/15 text-[#6e5527] dark:bg-[#8a6d3b]/30 dark:text-[#dcc494]",
];

type PersonLite = { id: string; name: string; phone: string | null; notes: string | null };
type PersonDetailResponse = { person: PersonLite; debts: DebtWithOutstanding[]; txns: TxnRow[] };
type FieldErrors = Record<string, string>;

/* ----------------------------------------------------------------- helpers */

function describeError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Returns a toast-able message, or null when the error was a 401 that has
 * already been routed to handleUnauthorized(). Uses a ref so callbacks stay
 * referentially stable despite the app context being recreated on renders.
 */
export function useApiGuard(): (err: unknown, fallback: string) => string | null {
  const { handleUnauthorized } = useApp();
  const ref = React.useRef(handleUnauthorized);
  React.useEffect(() => {
    ref.current = handleUnauthorized;
  });
  return React.useCallback((err: unknown, fallback: string): string | null => {
    if (err instanceof ApiError && err.status === 401) {
      ref.current();
      return null;
    }
    return describeError(err, fallback);
  }, []);
}

export function dispatchTxnChanged(): void {
  window.dispatchEvent(new Event("raqamora:txn-changed"));
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const dateFmt = new Intl.DateTimeFormat("en-PK", {
  timeZone: KARACHI_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-PK", {
  timeZone: KARACHI_TZ,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

/** Today in Asia/Karachi as YYYY-MM-DD. */
export function karachiTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KARACHI_TZ }).format(new Date());
}

/** Whole days from today (Karachi) until the given date; negative = past. */
export function daysUntil(iso: string): number {
  const raw = new Date(iso);
  if (Number.isNaN(raw.getTime())) return Number.NaN;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: KARACHI_TZ }).format(raw);
  const a = new Date(`${day}T00:00:00Z`).getTime();
  const b = new Date(`${karachiTodayStr()}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

export type DueStatusKey = "overdue" | "soon" | "later" | "none";

export function debtDueStatus(dueDate: string | null | undefined): { key: DueStatusKey; days: number } {
  if (!dueDate) return { key: "none", days: 0 };
  const days = daysUntil(dueDate);
  if (Number.isNaN(days)) return { key: "none", days: 0 };
  if (days < 0) return { key: "overdue", days };
  if (days <= 7) return { key: "soon", days };
  return { key: "later", days };
}

/** +1 money arrives in accounts, −1 money leaves, 0 neutral (transfer). */
export function txnFlowSign(type: string, signed: number): number {
  switch (type) {
    case "INCOME":
    case "BORROWED":
    case "REFUND":
    case "REPAYMENT_RECEIVED":
      return 1;
    case "EXPENSE":
    case "LENT":
    case "REPAYMENT_MADE":
      return -1;
    case "ADJUSTMENT":
      return signed >= 0 ? 1 : -1;
    default:
      return 0;
  }
}

/* ------------------------------------------------------------- primitives */

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  const tone = AVATAR_TONES[hashString(name) % AVATAR_TONES.length];
  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarFallback className={cn("text-[11px] font-semibold", tone)} aria-hidden>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export type StatTone = "pos" | "neg" | "neutral";

/** StatCard with an explicit money tone (emerald in / red out). */
export function ToneStatCard({
  label,
  value,
  tone,
  sub,
  className,
}: {
  label: string;
  value: number; // paisa
  tone: StatTone;
  sub?: string;
  className?: string;
}) {
  const toneCls = tone === "pos" ? "text-money-pos" : tone === "neg" ? "text-money-neg" : undefined;
  return (
    <div className={cn("rounded-xl border border-hairline bg-card p-4 shadow-card", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">{label}</p>
      <Money value={value} size="lg" className={cn("mt-1.5", toneCls)} />
      {sub ? <p className="mt-1 text-xs text-ink-soft">{sub}</p> : null}
    </div>
  );
}

function DirectionChip({ direction }: { direction: string }) {
  const recv = direction === "RECEIVABLE";
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 text-[10px] font-medium",
        recv
          ? "border-brand-emerald/25 bg-brand-emerald/10 text-brand-emerald-deep dark:border-brand-emerald/35 dark:bg-brand-emerald/20 dark:text-[#53c6ac]"
          : "border-danger-brand/25 bg-danger-brand/10 text-danger-brand dark:border-danger-brand/35 dark:bg-danger-brand/20 dark:text-[#e08a7f]",
      )}
    >
      {recv ? "You lent" : "You borrowed"}
    </Badge>
  );
}

function SettledChip() {
  return (
    <Badge
      variant="outline"
      className="border-brand-emerald/25 bg-brand-emerald/10 px-1.5 text-[10px] font-medium text-brand-emerald-deep dark:border-brand-emerald/35 dark:bg-brand-emerald/20 dark:text-[#53c6ac]"
    >
      <CheckCircle2 className="mr-0.5 size-3" aria-hidden />
      Settled
    </Badge>
  );
}

export function DueBadge({ dueDate, className }: { dueDate: string | null | undefined; className?: string }) {
  const due = debtDueStatus(dueDate);
  if (due.key === "none") return null;
  if (due.key === "overdue") {
    return (
      <Badge
        variant="outline"
        className={cn("border-danger-brand/30 bg-danger-brand/10 px-1.5 text-[10px] font-medium text-danger-brand", className)}
      >
        Overdue · {fmtDate(dueDate)}
      </Badge>
    );
  }
  if (due.key === "soon") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-warn-brand/35 bg-warn-brand/10 px-1.5 text-[10px] font-medium text-[#7c5d1d] dark:border-warn-brand/40 dark:bg-warn-brand/20 dark:text-[#d9b25f]",
          className,
        )}
      >
        {due.days === 0 ? "Due today" : `Due in ${due.days}d`}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("border-hairline bg-transparent px-1.5 text-[10px] text-ink-soft", className)}>
      Due {fmtDate(dueDate)}
    </Badge>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs font-medium text-danger-brand">{msg}</p>;
}

function AccountSelect({
  accounts,
  value,
  onChange,
  id,
  invalid,
}: {
  accounts: AccountWithBalance[] | null;
  value: string;
  onChange: (v: string) => void;
  id: string;
  invalid?: boolean;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className={cn("w-full", invalid && "border-danger-brand")}>
        <SelectValue placeholder={accounts === null ? "Loading accounts…" : "Choose an account"} />
      </SelectTrigger>
      <SelectContent>
        {(accounts ?? []).map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <span className="flex items-center gap-2">
              <AccountIcon type={a.type} className="size-3.5 text-ink-soft" />
              <span className="truncate">{a.name}</span>
              <span className="money ml-1 text-[11px] text-ink-soft">{formatPKR(a.balance, { compact: true })}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* --------------------------------------------------------------- DebtCard */

export function DebtCard({
  debt,
  onRepay,
  onEdit,
  onDelete,
  onOpenPerson,
  expanded = false,
  repayments = null,
  repaymentsLoading = false,
  onToggleRepayments,
  className,
}: {
  debt: DebtWithOutstanding;
  onRepay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenPerson?: () => void;
  expanded?: boolean;
  repayments?: TxnRow[] | null;
  repaymentsLoading?: boolean;
  onToggleRepayments?: () => void;
  className?: string;
}) {
  const isReceivable = debt.direction === "RECEIVABLE";
  const settled = debt.status === "SETTLED";
  const pct = debt.principal > 0 ? Math.min(100, Math.round((debt.repaid / debt.principal) * 100)) : 0;

  return (
    <div className={cn("rounded-xl border border-hairline bg-card p-4 shadow-card", className)}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {onOpenPerson ? (
          <button
            type="button"
            onClick={onOpenPerson}
            className="flex min-w-0 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open ${debt.personName}'s ledger`}
          >
            <PersonAvatar name={debt.personName} className="size-9" />
            <span className="truncate text-sm font-semibold text-ink underline-offset-2 hover:text-brand-emerald-deep hover:underline dark:hover:text-[#53c6ac]">
              {debt.personName}
            </span>
          </button>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <DirectionChip direction={debt.direction} />
          {settled ? <SettledChip /> : <DueBadge dueDate={debt.dueDate} />}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!settled && debt.outstanding > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-8 border-brand-emerald/40 text-brand-emerald-deep hover:bg-brand-emerald/10 dark:border-brand-emerald/40 dark:text-[#53c6ac] dark:hover:bg-brand-emerald/15"
              onClick={onRepay}
            >
              <HandCoins className="size-3.5" aria-hidden />
              Repay
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Entry actions">
                <Ellipsis className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-3.5" aria-hidden />
                Edit note / due date
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-danger-brand focus:text-danger-brand">
                <Trash2 className="size-3.5" aria-hidden />
                Delete entry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-soft">Outstanding</p>
          <Money
            value={debt.outstanding}
            className={settled ? undefined : isReceivable ? "text-money-pos" : "text-money-neg"}
          />
        </div>
        <p className="text-xs text-ink-soft">
          of <span className="money font-medium text-ink">{formatPKR(debt.principal)}</span> principal
        </p>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`Repaid ${pct}% of principal`}
        >
          <div
            className={cn("h-full rounded-full", settled ? "bg-brand-emerald" : "bg-brand-emerald/70")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="money w-9 shrink-0 text-right text-[10px] text-ink-soft">{pct}%</span>
      </div>

      {debt.note ? <p className="mt-2 text-xs leading-relaxed text-ink-soft">{debt.note}</p> : null}

      {onToggleRepayments && debt.repaid > 0 ? (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={onToggleRepayments}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
            Repayment history
          </button>
          {expanded ? (
            repaymentsLoading ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                <Spinner className="size-3.5" /> Loading repayments…
              </div>
            ) : repayments && repayments.length > 0 ? (
              <ul className="mt-1.5 space-y-1 rounded-lg bg-muted/60 p-2.5">
                {repayments.map((r) => {
                  const sign = txnFlowSign(r.type, r.signed);
                  return (
                    <li key={r.id} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0 text-ink-soft">{fmtDateTime(r.date)}</span>
                      <TypeBadge type={r.type} />
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{r.note ?? r.accountName ?? "—"}</span>
                      <Money value={sign * r.amount} colored={sign !== 0} size="sm" className="shrink-0" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-ink-soft">No repayments recorded yet.</p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------- PersonDialog */

export function PersonDialog({
  open,
  onOpenChange,
  person,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PersonLite | null;
  onSaved: () => void;
}) {
  const guard = useApiGuard();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(person?.name ?? "");
      setPhone(person?.phone ?? "");
      setNotes(person?.notes ?? "");
      setFieldErrors({});
    }
  }, [open, person]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = personSchema.safeParse({
      name: name.trim(),
      phone: phone.trim() ? phone.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
    });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      if (person) {
        await apiSend(`/api/people/${person.id}`, "PATCH", parsed.data);
        toast.success("Person updated");
      } else {
        await apiSend("/api/people", "POST", parsed.data);
        toast.success(`${parsed.data.name} added to your khata`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const msg = guard(err, "Could not save this person");
      if (msg) toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{person ? "Edit person" : "Add person"}</DialogTitle>
          <DialogDescription>
            {person
              ? "Update their contact details or notes."
              : "Add the people you lend to or borrow from — Ali, Fatima, your shopkeeper…"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="person-name">Name</Label>
            <Input
              id="person-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ali Raza"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.name) || undefined}
            />
            <FieldError msg={fieldErrors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="person-phone">Phone (optional)</Label>
            <Input
              id="person-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0300 1234567"
              inputMode="tel"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.phone) || undefined}
            />
            <FieldError msg={fieldErrors.phone} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="person-notes">Notes (optional)</Label>
            <Textarea
              id="person-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Colleague from office — repays at month end"
              rows={2}
            />
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 text-current" /> : null}
              {person ? "Save changes" : "Add person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------- DebtDialog */

export function DebtDialog({
  open,
  onOpenChange,
  people,
  lockedPerson,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: PersonRow[];
  lockedPerson?: PersonLite | null;
  onSaved: () => void;
}) {
  const guard = useApiGuard();
  const [mode, setMode] = React.useState<"select" | "create">("select");
  const [personId, setPersonId] = React.useState("");
  const [createName, setCreateName] = React.useState("");
  const [createPhone, setCreatePhone] = React.useState("");
  const [direction, setDirection] = React.useState<"RECEIVABLE" | "PAYABLE">("RECEIVABLE");
  const [amount, setAmount] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [recordNow, setRecordNow] = React.useState(true);
  const [accounts, setAccounts] = React.useState<AccountWithBalance[] | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const peopleCountRef = React.useRef(people.length);
  React.useEffect(() => {
    peopleCountRef.current = people.length;
  }, [people.length]);

  const lockedRef = React.useRef(lockedPerson);
  React.useEffect(() => {
    lockedRef.current = lockedPerson;
  });

  React.useEffect(() => {
    if (!open) return;
    const locked = lockedRef.current;
    setMode(locked || peopleCountRef.current > 0 ? "select" : "create");
    setPersonId(locked?.id ?? "");
    setCreateName("");
    setCreatePhone("");
    setDirection("RECEIVABLE");
    setAmount("");
    setDueDate("");
    setNote("");
    setAccountId("");
    setRecordNow(true);
    setFieldErrors({});
    setServerError(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setAccounts(null);
    apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts")
      .then(({ accounts: rows }) => {
        if (alive) setAccounts(rows.filter((a) => !a.archived));
      })
      .catch(() => {
        if (alive) setAccounts([]);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const sortedPeople = React.useMemo(
    () => [...people].sort((a, b) => a.name.localeCompare(b.name)),
    [people],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: FieldErrors = {};
    const principal = parseRupeesToPaisa(amount) ?? -1;
    if (!lockedPerson && mode === "create" && !createName.trim()) errs.person = "Name is required";
    if (!lockedPerson && mode === "select" && !personId) errs.person = "Choose a person";
    if (principal <= 0) errs.amount = "Enter a valid amount";
    if (recordNow && !accountId) {
      errs.account =
        accounts && accounts.length === 0
          ? "No accounts yet — add one first or save as ledger-only"
          : "Choose the account the money moved through";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    setSaving(true);
    try {
      let personIdForEntry = lockedPerson?.id ?? personId;
      if (!lockedPerson && mode === "create") {
        const created = await apiSend<{ person: { id: string } }>("/api/people", "POST", {
          name: createName.trim(),
          phone: createPhone.trim() ? createPhone.trim() : null,
          notes: null,
        });
        personIdForEntry = created.person.id;
      }
      const { debt } = await apiSend<{ debt: DebtWithOutstanding }>("/api/debts", "POST", {
        personId: personIdForEntry,
        direction,
        principalRupees: principal / 100,
        note: note.trim() ? note.trim() : null,
        dueDate: dueDate ? dueDate : null,
        accountId: recordNow ? accountId : null,
        recordNow,
      });
      toast.success(
        `Ledger entry saved — ${formatPKR(debt.principal)} ${direction === "RECEIVABLE" ? "lent to" : "borrowed from"} ${debt.personName}`,
      );
      if (recordNow) dispatchTxnChanged();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        guard(err, "");
        return;
      }
      setServerError(describeError(err, "Could not save this entry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New ledger entry</DialogTitle>
          <DialogDescription>
            Record money you lent or borrowed. RAQAMORA keeps a running balance per person, like a digital khata.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Person */}
          {lockedPerson ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-muted/50 p-2.5">
              <PersonAvatar name={lockedPerson.name} className="size-8" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{lockedPerson.name}</p>
                <p className="text-[11px] text-ink-soft">Entry will be added to their ledger</p>
              </div>
            </div>
          ) : mode === "select" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="debt-person">Person</Label>
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className="inline-flex items-center gap-1 rounded text-xs font-medium text-brand-emerald-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-[#53c6ac]"
                >
                  <Plus className="size-3" aria-hidden /> New person
                </button>
              </div>
              <Select value={personId ?? ""} onValueChange={setPersonId}>
                <SelectTrigger id="debt-person" aria-invalid={Boolean(fieldErrors.person) || undefined} className={cn("w-full", fieldErrors.person && "border-danger-brand")}>
                  <SelectValue placeholder="Who is this entry for?" />
                </SelectTrigger>
                <SelectContent>
                  {sortedPeople.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <PersonAvatar name={p.name} className="size-5" />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={fieldErrors.person} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="debt-new-person">New person</Label>
                <button
                  type="button"
                  onClick={() => setMode("select")}
                  className="rounded text-xs font-medium text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Pick from list instead
                </button>
              </div>
              <Input
                id="debt-new-person"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Full name — e.g. Hassan Iqbal"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.person) || undefined}
              />
              <Input
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="Phone (optional)"
                inputMode="tel"
                autoComplete="off"
              />
              <FieldError msg={fieldErrors.person} />
            </div>
          )}

          {/* Direction toggle */}
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Ledger direction">
              {(
                [
                  { key: "RECEIVABLE", label: "I lent money", sub: "They owe you", Icon: ArrowUpRight },
                  { key: "PAYABLE", label: "I borrowed money", sub: "You owe them", Icon: ArrowDownLeft },
                ] as const
              ).map(({ key, label, sub, Icon }) => {
                const active = direction === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDirection(key)}
                    className={cn(
                      "flex min-h-14 flex-col items-start justify-center rounded-md px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-card shadow-card" : "hover:bg-card/60",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <Icon
                        className={cn("size-3.5", key === "RECEIVABLE" ? "text-money-pos" : "text-money-neg")}
                        aria-hidden
                      />
                      {label}
                    </span>
                    <span className="text-[11px] text-ink-soft">{sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="debt-amount">Principal amount</Label>
            <div className="relative">
              <span className="money pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                Rs
              </span>
              <Input
                id="debt-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                autoComplete="off"
                className={cn("pl-10", fieldErrors.amount && "border-danger-brand")}
                aria-invalid={Boolean(fieldErrors.amount) || undefined}
              />
            </div>
            <FieldError msg={fieldErrors.amount} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="debt-due">Due date (optional)</Label>
              <Input id="debt-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-note">Note (optional)</Label>
              <Input
                id="debt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. For the shop stock"
                maxLength={500}
              />
            </div>
          </div>

          {/* Record now */}
          <div className="rounded-lg border border-hairline bg-muted/40 p-3">
            <label htmlFor="debt-record-now" className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                id="debt-record-now"
                checked={recordNow}
                onCheckedChange={(v) => setRecordNow(v === true)}
              />
              <span className="text-[13px] font-medium text-ink">Record the money movement now</span>
            </label>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Lending reduces the account balance; borrowing increases it. Ledger-only entries are also allowed.
            </p>
            {recordNow ? (
              <div className="mt-2.5 space-y-1.5">
                <Label htmlFor="debt-account">Account</Label>
                <AccountSelect
                  id="debt-account"
                  accounts={accounts}
                  value={accountId}
                  onChange={setAccountId}
                  invalid={Boolean(fieldErrors.account)}
                />
                <FieldError msg={fieldErrors.account} />
              </div>
            ) : null}
          </div>

          {serverError ? (
            <p className="rounded-lg border border-danger-brand/30 bg-danger-brand/[0.06] px-3 py-2 text-xs font-medium text-danger-brand">
              {serverError}
            </p>
          ) : null}

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 text-current" /> : null}
              Save entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------- RepaymentDialog */

export function RepaymentDialog({
  open,
  onOpenChange,
  debts,
  initialDebtId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debts: DebtWithOutstanding[];
  initialDebtId?: string | null;
  onSaved: () => void;
}) {
  const guard = useApiGuard();
  const [selectedId, setSelectedId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [accounts, setAccounts] = React.useState<AccountWithBalance[] | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const debt = React.useMemo(
    () => debts.find((d) => d.id === selectedId) ?? debts[0] ?? null,
    [debts, selectedId],
  );

  const debtsRef = React.useRef(debts);
  React.useEffect(() => {
    debtsRef.current = debts;
  });

  React.useEffect(() => {
    if (!open) return;
    setSelectedId(initialDebtId ?? debtsRef.current[0]?.id ?? "");
    setAmount("");
    setAccountId("");
    setDate(karachiTodayStr());
    setNote("");
    setFieldErrors({});
    setServerError(null);
  }, [open, initialDebtId]);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setAccounts(null);
    apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts")
      .then(({ accounts: rows }) => {
        if (alive) setAccounts(rows.filter((a) => !a.archived));
      })
      .catch(() => {
        if (alive) setAccounts([]);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt) return;
    const errs: FieldErrors = {};
    const paisa = parseRupeesToPaisa(amount) ?? -1;
    if (paisa <= 0) errs.amount = "Enter a valid amount";
    else if (paisa > debt.outstanding) errs.amount = "Cannot exceed outstanding";
    if (!accountId) errs.account = "Choose the account the cash moved through";
    if (!date) errs.date = "Date is required";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    setSaving(true);
    try {
      const { debt: updated } = await apiSend<{ debt: DebtWithOutstanding }>("/api/debts/repay", "POST", {
        debtId: debt.id,
        amountRupees: paisa / 100,
        accountId,
        date,
        note: note.trim() ? note.trim() : null,
      });
      toast.success(`Repayment recorded — outstanding now ${formatPKR(updated.outstanding)}`);
      dispatchTxnChanged();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        guard(err, "");
        return;
      }
      setServerError(describeError(err, "Could not record the repayment"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record repayment</DialogTitle>
          <DialogDescription>
            Money actually received or paid — it reduces the outstanding balance and appears in the activity history.
          </DialogDescription>
        </DialogHeader>
        {debts.length === 0 || !debt ? (
          <p className="rounded-lg border border-hairline bg-muted/40 px-3 py-4 text-center text-xs text-ink-soft">
            There is nothing to repay — every entry is settled.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {debts.length > 1 ? (
              <div className="space-y-1.5">
                <Label htmlFor="repay-debt">Entry</Label>
                <Select value={debt.id} onValueChange={setSelectedId}>
                  <SelectTrigger id="repay-debt" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {debts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="flex items-center gap-2">
                          <span className="truncate">
                            {d.direction === "RECEIVABLE" ? "You lent" : "You borrowed"} {formatPKR(d.outstanding, { compact: true })}
                          </span>
                          <span className="text-[11px] text-ink-soft">· {d.personName}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-hairline bg-muted/40 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {debt.direction === "RECEIVABLE" ? "You lent" : "You borrowed"} · {debt.personName}
                  </p>
                  {debt.note ? <p className="truncate text-[11px] text-ink-soft">{debt.note}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft">Outstanding</p>
                  <Money value={debt.outstanding} size="sm" className={debt.direction === "RECEIVABLE" ? "text-money-pos" : "text-money-neg"} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="repay-amount">Repayment amount</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-ink-soft hover:text-ink"
                  onClick={() => setAmount(String(debt.outstanding / 100))}
                >
                  Full outstanding
                </Button>
              </div>
              <div className="relative">
                <span className="money pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                  Rs
                </span>
                <Input
                  id="repay-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  autoComplete="off"
                  className={cn("pl-10", fieldErrors.amount && "border-danger-brand")}
                  aria-invalid={Boolean(fieldErrors.amount) || undefined}
                />
              </div>
              <FieldError msg={fieldErrors.amount} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="repay-account">Account</Label>
                <AccountSelect
                  id="repay-account"
                  accounts={accounts}
                  value={accountId}
                  onChange={setAccountId}
                  invalid={Boolean(fieldErrors.account)}
                />
                <FieldError msg={fieldErrors.account} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="repay-date">Date</Label>
                <Input
                  id="repay-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.date) || undefined}
                />
                <FieldError msg={fieldErrors.date} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="repay-note">Note (optional)</Label>
              <Input
                id="repay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Paid back via Easypaisa"
                maxLength={500}
              />
            </div>

            {serverError ? (
              <p className="rounded-lg border border-danger-brand/30 bg-danger-brand/[0.06] px-3 py-2 text-xs font-medium text-danger-brand">
                {serverError}
              </p>
            ) : null}

            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner className="size-4 text-current" /> : null}
                Record repayment
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------- DebtEditDialog */

export function DebtEditDialog({
  open,
  onOpenChange,
  debt,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: DebtWithOutstanding | null;
  onSaved: () => void;
}) {
  const guard = useApiGuard();
  const [dueDate, setDueDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && debt) {
      setDueDate(debt.dueDate ? debt.dueDate.slice(0, 10) : "");
      setNote(debt.note ?? "");
    }
  }, [open, debt]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt) return;
    setSaving(true);
    try {
      await apiSend(`/api/debts/${debt.id}`, "PATCH", {
        note: note.trim() ? note.trim() : null,
        dueDate: dueDate ? dueDate : null,
      });
      toast.success("Entry updated");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const msg = guard(err, "Could not update this entry");
      if (msg) toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit entry</DialogTitle>
          <DialogDescription>
            Principal and repayments are permanent money records — here you can adjust the note and due date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="debt-edit-due">Due date</Label>
            <Input id="debt-edit-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-[11px] text-ink-soft">Leave empty for no due date.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="debt-edit-note">Note</Label>
            <Textarea
              id="debt-edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Add context for this entry"
            />
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
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

/* ------------------------------------------------------------ PersonDetail */

function PersonDetail({
  personId,
  onBack,
  onLedgerChanged,
}: {
  personId: string;
  onBack: () => void;
  onLedgerChanged: () => void;
}) {
  const guard = useApiGuard();
  const [data, setData] = React.useState<PersonDetailResponse | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [txns, setTxns] = React.useState<TxnRow[] | null>(null);
  const [txnError, setTxnError] = React.useState<string | null>(null);
  const [txnsLoading, setTxnsLoading] = React.useState(true);

  const [repaymentCache, setRepaymentCache] = React.useState<Record<string, TxnRow[]>>({});
  const [expandedDebt, setExpandedDebt] = React.useState<string | null>(null);
  const [repayLoadingId, setRepayLoadingId] = React.useState<string | null>(null);

  const [debtDialogOpen, setDebtDialogOpen] = React.useState(false);
  const [repayOpen, setRepayOpen] = React.useState(false);
  const [repayInitialId, setRepayInitialId] = React.useState<string | null>(null);
  const [editDebt, setEditDebt] = React.useState<DebtWithOutstanding | null>(null);
  const [deleteDebt, setDeleteDebt] = React.useState<DebtWithOutstanding | null>(null);
  const [deletingDebt, setDeletingDebt] = React.useState(false);
  const [personEditOpen, setPersonEditOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const detail = await apiGet<PersonDetailResponse>(`/api/people/${personId}`);
      setData(detail);
      setDetailError(null);
    } catch (err) {
      const msg = guard(err, "Could not load this ledger");
      if (msg === null) return;
      setDetailError(msg);
    } finally {
      setLoading(false);
    }
  }, [personId, guard]);

  const loadTxns = React.useCallback(async () => {
    setTxnsLoading(true);
    try {
      const { txns: rows } = await apiGet<{ txns: TxnRow[] }>(
        `/api/transactions${qs({ personId, sort: "date_desc", pageSize: 100 })}`,
      );
      setTxns(rows);
      setTxnError(null);
    } catch (err) {
      const msg = guard(err, "Could not load activity history");
      if (msg === null) return;
      setTxnError(msg);
    } finally {
      setTxnsLoading(false);
    }
  }, [personId, guard]);

  const refresh = React.useCallback(() => {
    setRepaymentCache({});
    setExpandedDebt(null);
    void load();
    void loadTxns();
    onLedgerChanged();
  }, [load, loadTxns, onLedgerChanged]);

  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    void loadTxns();
  }, [loadTxns]);

  React.useEffect(() => {
    const handler = () => {
      void load();
      void loadTxns();
    };
    window.addEventListener("raqamora:txn-changed", handler);
    return () => window.removeEventListener("raqamora:txn-changed", handler);
  }, [load, loadTxns]);

  async function toggleRepayments(debtId: string) {
    if (expandedDebt === debtId) {
      setExpandedDebt(null);
      return;
    }
    setExpandedDebt(debtId);
    if (repaymentCache[debtId]) return;
    setRepayLoadingId(debtId);
    try {
      const { repayments: rows } = await apiGet<{ debt: DebtWithOutstanding; repayments: TxnRow[] }>(
        `/api/debts/${debtId}`,
      );
      setRepaymentCache((prev) => ({ ...prev, [debtId]: rows }));
    } catch (err) {
      const msg = guard(err, "Could not load repayment history");
      if (msg) toast.error(msg);
    } finally {
      setRepayLoadingId(null);
    }
  }

  function exportCsv() {
    const a = document.createElement("a");
    a.href = `/api/export/transactions?personId=${encodeURIComponent(personId)}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function confirmDeleteDebt() {
    if (!deleteDebt) return;
    setDeletingDebt(true);
    try {
      await apiSend(`/api/debts/${deleteDebt.id}`, "DELETE");
      toast.success("Ledger entry deleted");
      setDeleteDebt(null);
      dispatchTxnChanged();
      refresh();
    } catch (err) {
      setDeletingDebt(false);
      setDeleteDebt(null);
      const msg = guard(err, "Could not delete this entry");
      if (msg) toast.error(msg, { description: "Entries with repayments recorded cannot be deleted — remove those repayment transactions first." });
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="min-h-9" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to people
        </Button>
        <SkeletonList rows={5} />
      </div>
    );
  }

  if (detailError || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="min-h-9" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to people
        </Button>
        <EmptyState
          icon={AlertTriangle}
          title="Could not load this ledger"
          description={detailError ?? "The person may have been removed."}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      </div>
    );
  }

  const { person, debts } = data;
  const receivable = debts.filter((d) => d.direction === "RECEIVABLE").reduce((s, d) => s + d.outstanding, 0);
  const payable = debts.filter((d) => d.direction === "PAYABLE").reduce((s, d) => s + d.outstanding, 0);
  const net = receivable - payable;
  const openDebts = debts.filter((d) => d.status !== "SETTLED").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const settledDebts = debts.filter((d) => d.status === "SETTLED");
  const orderedDebts = [...openDebts, ...settledDebts];

  return (
    <div className="print-area space-y-4">
      <style>{PRINT_CSS}</style>
      <style>{SCROLL_CSS}</style>

      {/* Breadcrumb bar */}
      <div className="flex items-center justify-between gap-2">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="icon"
            className="no-print size-9 shrink-0"
            onClick={onBack}
            aria-label="Back to people"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="no-print rounded px-0.5 font-medium text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            People
          </button>
          <span className="px-0.5 text-ink-soft" aria-hidden>
            /
          </span>
          <span className="min-w-0 truncate font-semibold text-ink">{person.name}</span>
        </nav>
        <Button variant="outline" size="sm" className="no-print min-h-9" onClick={() => setPersonEditOpen(true)}>
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Button>
      </div>

      {/* Identity header */}
      <div className="rounded-xl border border-hairline bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-start gap-3.5">
          <PersonAvatar name={person.name} className="size-12" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-ink">{person.name}</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {person.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" aria-hidden />
                  {person.phone}
                </span>
              ) : (
                "No phone saved"
              )}
            </p>
            {person.notes ? (
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-ink-soft">{person.notes}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Position cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <ToneStatCard
          label="They owe me"
          value={receivable}
          tone="pos"
          sub={`${debts.filter((d) => d.direction === "RECEIVABLE" && d.status !== "SETTLED").length} open entr${
            debts.filter((d) => d.direction === "RECEIVABLE" && d.status !== "SETTLED").length === 1 ? "y" : "ies"
          }`}
        />
        <ToneStatCard
          label="I owe them"
          value={payable}
          tone="neg"
          sub={`${debts.filter((d) => d.direction === "PAYABLE" && d.status !== "SETTLED").length} open entr${
            debts.filter((d) => d.direction === "PAYABLE" && d.status !== "SETTLED").length === 1 ? "y" : "ies"
          }`}
        />
        <ToneStatCard label="Net position" value={net} tone="neutral" sub="Receivable minus payable" />
      </div>

      {/* Actions */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button size="sm" className="min-h-9" onClick={() => setDebtDialogOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New ledger entry
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-9"
          disabled={openDebts.length === 0}
          onClick={() => {
            setRepayInitialId(null);
            setRepayOpen(true);
          }}
        >
          <HandCoins className="size-4" aria-hidden />
          Record repayment
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="min-h-9">
              Statement
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={exportCsv}>
              <Download className="size-3.5" aria-hidden />
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.print()}>
              <Printer className="size-3.5" aria-hidden />
              Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Their ledger entries */}
      <SectionCard
        title="Their ledger entries"
        subtitle="Loans and borrowings between you two"
        contentClassName={orderedDebts.length > 0 ? "space-y-3" : undefined}
      >
        {orderedDebts.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No ledger entries yet"
            description="Record money you lent or borrowed with this person — every entry keeps their running balance honest."
            actionLabel="New ledger entry"
            onAction={() => setDebtDialogOpen(true)}
          />
        ) : (
          <div className="space-y-3">
            {orderedDebts.map((d) => (
              <DebtCard
                key={d.id}
                debt={d}
                expanded={expandedDebt === d.id}
                repayments={repaymentCache[d.id] ?? null}
                repaymentsLoading={repayLoadingId === d.id}
                onToggleRepayments={() => void toggleRepayments(d.id)}
                onRepay={() => {
                  setRepayInitialId(d.id);
                  setRepayOpen(true);
                }}
                onEdit={() => setEditDebt(d)}
                onDelete={() => setDeleteDebt(d)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Full activity history */}
      <SectionCard title="Full activity" subtitle={`Every transaction with ${person.name}`}>
        {txnError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load activity"
            description={txnError}
            actionLabel="Try again"
            onAction={() => void loadTxns()}
          />
        ) : txnsLoading && txns === null ? (
          <SkeletonList rows={4} />
        ) : txns === null || txns.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            description="Ledger entries and repayments with this person will appear here in order, newest first."
          />
        ) : (
          <ul className="rq-scroll max-h-96 divide-y divide-border overflow-y-auto pr-1">
            {txns.map((t) => {
              const sign = txnFlowSign(t.type, t.signed);
              return (
                <li key={t.id} className="flex items-center gap-2.5 py-2.5">
                  <span className="w-14 shrink-0 text-[11px] leading-tight text-ink-soft">{fmtDate(t.date)}</span>
                  <div className="min-w-0 flex-1">
                    <TypeBadge type={t.type} />
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {t.note ?? t.categoryName ?? t.accountName ?? "—"}
                    </p>
                  </div>
                  <span className="hidden w-24 shrink-0 truncate text-right text-[11px] text-ink-soft sm:block">
                    {t.accountName ?? "—"}
                  </span>
                  <Money value={sign * t.amount} colored={sign !== 0} size="sm" className="shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Dialogs */}
      <DebtDialog
        open={debtDialogOpen}
        onOpenChange={setDebtDialogOpen}
        people={[]}
        lockedPerson={person}
        onSaved={refresh}
      />
      <RepaymentDialog
        open={repayOpen}
        onOpenChange={setRepayOpen}
        debts={openDebts}
        initialDebtId={repayInitialId}
        onSaved={refresh}
      />
      <DebtEditDialog
        open={editDebt !== null}
        onOpenChange={(o) => !o && setEditDebt(null)}
        debt={editDebt}
        onSaved={refresh}
      />
      <PersonDialog open={personEditOpen} onOpenChange={setPersonEditOpen} person={person} onSaved={refresh} />
      <ConfirmDialog
        open={deleteDebt !== null}
        onOpenChange={(o) => !o && setDeleteDebt(null)}
        title="Delete this ledger entry?"
        description={
          deleteDebt
            ? `${formatPKR(deleteDebt.principal)} ${deleteDebt.direction === "RECEIVABLE" ? "lent to" : "borrowed from"} ${deleteDebt.personName} will be removed along with its original transaction.`
            : undefined
        }
        confirmLabel="Delete entry"
        destructive
        loading={deletingDebt}
        onConfirm={() => void confirmDeleteDebt()}
      />
    </div>
  );
}

/* --------------------------------------------------------------- the view */

function PersonBalanceLines({ person, align = "left" }: { person: PersonRow; align?: "left" | "right" }) {
  const hasRecv = person.receivableOutstanding > 0;
  const hasPay = person.payableOutstanding > 0;
  if (!hasRecv && !hasPay) {
    return <p className={cn("text-xs text-ink-soft", align === "right" && "text-right")}>Settled</p>;
  }
  return (
    <div className={cn("space-y-0.5", align === "right" && "text-right")}>
      {hasRecv ? (
        <p className="money text-[13px] font-semibold text-money-pos">owes you {formatPKR(person.receivableOutstanding)}</p>
      ) : null}
      {hasPay ? (
        <p className="money text-[13px] font-semibold text-money-neg">you owe {formatPKR(person.payableOutstanding)}</p>
      ) : null}
    </div>
  );
}

export default function PeopleView(_props: ViewProps) {
  const guard = useApiGuard();
  const [people, setPeople] = React.useState<PersonRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [personDialogOpen, setPersonDialogOpen] = React.useState(false);
  const [editPerson, setEditPerson] = React.useState<PersonRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PersonRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const pendingSelectRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem(SELECTED_PERSON_KEY);
    if (stored) {
      window.sessionStorage.removeItem(SELECTED_PERSON_KEY);
      pendingSelectRef.current = stored;
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      const { people: rows } = await apiGet<{ people: PersonRow[] }>("/api/people");
      setPeople(rows);
      setLoadError(null);
      if (pendingSelectRef.current && rows.some((r) => r.id === pendingSelectRef.current)) {
        setSelectedId(pendingSelectRef.current);
        pendingSelectRef.current = null;
      }
    } catch (err) {
      const msg = guard(err, "Could not load people");
      if (msg === null) return;
      setLoadError(msg);
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

  async function confirmDeletePerson() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/people/${deleteTarget.id}`, "DELETE");
      toast.success("Person removed");
      setDeleteTarget(null);
      void load();
    } catch (err) {
      setDeleting(false);
      setDeleteTarget(null);
      const msg = guard(err, "Could not delete this person");
      if (msg) {
        toast.error(msg, {
          description: "People with ledger history — debts or transactions — cannot be deleted; the khata stays intact.",
        });
      }
    }
  }

  if (selectedId) {
    return <PersonDetail personId={selectedId} onBack={() => setSelectedId(null)} onLedgerChanged={() => void load()} />;
  }

  const rows = people ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((p) => p.name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q))
    : rows;
  const totalReceivable = rows.reduce((s, p) => s + p.receivableOutstanding, 0);
  const totalPayable = rows.reduce((s, p) => s + p.payableOutstanding, 0);
  const recvCount = rows.filter((p) => p.receivableOutstanding > 0).length;
  const payCount = rows.filter((p) => p.payableOutstanding > 0).length;

  return (
    <div className="space-y-4">
      <style>{SCROLL_CSS}</style>
      <PageHeader
        title="People"
        description="Your digital khata — who owes you, whom you owe"
        actions={
          <Button
            size="sm"
            className="min-h-9"
            onClick={() => {
              setEditPerson(null);
              setPersonDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add person
          </Button>
        }
      />

      {/* Summary band */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ToneStatCard
          label="Total to receive"
          value={totalReceivable}
          tone="pos"
          sub={recvCount > 0 ? `${recvCount} ${recvCount === 1 ? "person owes" : "people owe"} you` : "Nobody owes you right now"}
        />
        <ToneStatCard
          label="Total to pay"
          value={totalPayable}
          tone="neg"
          sub={payCount > 0 ? `You owe ${payCount} ${payCount === 1 ? "person" : "people"}` : "You owe nobody right now"}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…"
          aria-label="Search people by name or phone"
          className="pl-9"
        />
      </div>

      {/* List */}
      {loadError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load people"
          description={loadError}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : people === null ? (
        <SkeletonList rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Your khata is empty"
          description="Add the people you lend to or borrow from — Ali, Fatima, your shopkeeper…"
          actionLabel="Add person"
          onAction={() => {
            setEditPerson(null);
            setPersonDialogOpen(true);
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={`No people match “${query.trim()}”`} description="Try a different name or phone number." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <div className="flex items-center gap-2 rounded-xl border border-hairline bg-card p-3.5 shadow-card transition-colors hover:border-brand-emerald/40">
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Open ${p.name}'s ledger`}
                >
                  <PersonAvatar name={p.name} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                      {p.phone ?? "No phone saved"}
                      {p.lastActivity ? ` · Last activity ${fmtDate(p.lastActivity)}` : " · No activity yet"}
                    </span>
                  </span>
                  <span className="shrink-0 pl-1">
                    <PersonBalanceLines person={p} align="right" />
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Actions for ${p.name}`}>
                      <Ellipsis className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditPerson(p);
                        setPersonDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="text-danger-brand focus:text-danger-brand">
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Dialogs */}
      <PersonDialog
        open={personDialogOpen}
        onOpenChange={setPersonDialogOpen}
        person={editPerson}
        onSaved={() => void load()}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "this person"}?`}
        description="Only possible when they have no ledger history. If they have debts or transactions, their khata is kept."
        confirmLabel="Delete person"
        destructive
        loading={deleting}
        onConfirm={() => void confirmDeletePerson()}
      />
    </div>
  );
}
