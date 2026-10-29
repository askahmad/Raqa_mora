/**
 * RAQAMORA finance domain rules — the single source of truth for how each
 * transaction type affects account balances, income/expense totals and
 * receivables/payables. Shared by API routes and UI. Pure functions only.
 */
import type { AccountWithBalance, DebtWithOutstanding, PeriodSummary } from "@/lib/raqamora/types";

export const TXN_TYPES = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "LENT",
  "BORROWED",
  "REPAYMENT_RECEIVED",
  "REPAYMENT_MADE",
  "REFUND",
  "ADJUSTMENT",
] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export const TXN_TYPE_LABELS: Record<TxnType, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  LENT: "Money Lent",
  BORROWED: "Money Borrowed",
  REPAYMENT_RECEIVED: "Repayment Received",
  REPAYMENT_MADE: "Repayment Made",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
};

export const ACCOUNT_TYPES = ["CASH", "BANK", "EASYPAISA", "JAZZCASH", "SAVINGS", "CUSTOM"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Cash in Hand",
  BANK: "Bank Account",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  SAVINGS: "Savings Account",
  CUSTOM: "Custom",
};

/** Which fields are required per transaction type (for dynamic form). */
export function txnFieldRequirements(type: TxnType) {
  return {
    needsAccount: type !== "TRANSFER",
    needsToAccount: type === "TRANSFER",
    needsCategory: type === "INCOME" || type === "EXPENSE" || type === "REFUND",
    needsPerson: ["LENT", "BORROWED", "REPAYMENT_RECEIVED", "REPAYMENT_MADE"].includes(type),
    needsReason: type === "ADJUSTMENT",
  };
}

/**
 * Effect on the "from" account balance (signed paisa delta).
 * LENT decreases cash; BORROWED/REFUND/REPAYMENT_RECEIVED increase it.
 */
export function accountDelta(type: TxnType, amount: number, signed: number): number {
  switch (type) {
    case "INCOME":
      return amount;
    case "EXPENSE":
      return -amount;
    case "LENT":
      return -amount;
    case "BORROWED":
      return amount;
    case "REPAYMENT_RECEIVED":
      return amount;
    case "REPAYMENT_MADE":
      return -amount;
    case "REFUND":
      return amount;
    case "ADJUSTMENT":
      return signed * amount;
    case "TRANSFER":
      return -amount; // from-account delta; to-account gets +amount
    default:
      return 0;
  }
}

export function isFromAccountType(type: TxnType): boolean {
  return type !== "TRANSFER";
}
export function isToAccountType(type: TxnType): boolean {
  return type === "TRANSFER";
}

/**
 * Compute an account's current balance from its opening balance plus all
 * transaction effects (both from- and to-account roles).
 */
export function computeAccountBalance(
  account: { openingBalance: number },
  txns: Array<{ type: string; amount: number; signed: number; accountId: string | null; toAccountId: string | null }>,
  accountId: string,
): number {
  let balance = account.openingBalance;
  for (const t of txns) {
    if (t.toAccountId === accountId && t.type === "TRANSFER") {
      balance += t.amount;
    } else if (t.accountId === accountId) {
      balance += accountDelta(t.type as TxnType, t.amount, t.signed);
    }
  }
  return balance;
}

/** Outstanding amount on a debt = principal − sum of linked repayments. */
export function computeDebtOutstanding(
  debt: { principal: number; direction: string },
  repayments: Array<{ amount: number }>,
): number {
  const repaid = repayments.reduce((s, r) => s + r.amount, 0);
  return Math.max(0, debt.principal - repaid);
}

/** Aggregate period summary from transactions (transfers/loans excluded from income/expense). */
export function computePeriodSummary(
  txns: Array<{ type: string; amount: number; signed: number }>,
): PeriodSummary {
  let income = 0;
  let expense = 0;
  let refunds = 0;
  let lent = 0;
  let borrowed = 0;
  let repaidReceived = 0;
  let repaidMade = 0;
  let transfers = 0;
  for (const t of txns) {
    switch (t.type) {
      case "INCOME": income += t.amount; break;
      case "EXPENSE": expense += t.amount; break;
      case "REFUND": refunds += t.amount; break;
      case "LENT": lent += t.amount; break;
      case "BORROWED": borrowed += t.amount; break;
      case "REPAYMENT_RECEIVED": repaidReceived += t.amount; break;
      case "REPAYMENT_MADE": repaidMade += t.amount; break;
      case "TRANSFER": transfers += t.amount; break;
      // ADJUSTMENT affects balances only
    }
  }
  const netExpense = Math.max(0, expense - refunds);
  return {
    income,
    expense,
    refunds,
    netExpense,
    netSavings: income - netExpense,
    lent,
    borrowed,
    repaidReceived,
    repaidMade,
    transfers,
  };
}

/** Net financial position = account balances + receivables − payables. */
export function computeNetPosition(
  accountBalances: number[],
  debts: DebtWithOutstanding[],
): number {
  const cash = accountBalances.reduce((s, b) => s + b, 0);
  const receivables = debts.filter((d) => d.direction === "RECEIVABLE").reduce((s, d) => s + d.outstanding, 0);
  const payables = debts.filter((d) => d.direction === "PAYABLE").reduce((s, d) => s + d.outstanding, 0);
  return cash + receivables - payables;
}

export type DebtRow = {
  id: string;
  personId: string;
  personName: string;
  direction: string;
  principal: number;
  outstanding: number;
  dueDate: string | null;
  status: string;
  note: string | null;
};

export type { AccountWithBalance };
