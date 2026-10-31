/** Shared RAQAMORA types used by both API routes and UI components. */
import type { TxnType, AccountType } from "@/lib/raqamora/finance";

export interface PeriodSummary {
  income: number;
  expense: number;
  refunds: number;
  netExpense: number;
  netSavings: number;
  lent: number;
  borrowed: number;
  repaidReceived: number;
  repaidMade: number;
  transfers: number;
}

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType | string;
  color: string;
  icon: string;
  archived: boolean;
  openingBalance: number;
  balance: number;
  txnCount: number;
  createdAt: string;
}

export interface DebtWithOutstanding {
  id: string;
  personId: string;
  personName: string;
  direction: "RECEIVABLE" | "PAYABLE" | string;
  principal: number;
  outstanding: number;
  repaid: number;
  dueDate: string | null;
  status: string;
  note: string | null;
  createdAt: string;
  offlinePending?: boolean;
}

export interface TxnRow {
  id: string;
  type: TxnType | string;
  amount: number;
  signed: number;
  date: string;
  note: string | null;
  reason: string | null;
  accountId: string | null;
  accountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  personId: string | null;
  personName: string | null;
  debtId: string | null;
  createdAt: string;
  offlinePending?: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE" | string;
  icon: string;
  archived: boolean;
  txnCount: number;
}

export interface PersonRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  receivableOutstanding: number;
  payableOutstanding: number;
  debtCount: number;
  lastActivity: string | null;
}

export interface BudgetRow {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  amount: number; // limit
  used: number; // spent this month in category
  remaining: number;
  percent: number;
  month: string;
}

export interface GoalRow {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  note: string | null;
  percent: number;
  contributions: Array<{ id: string; amount: number; date: string; note: string | null }>;
}

export interface RecurringRow {
  id: string;
  title: string;
  type: string;
  amount: number;
  frequency: string;
  nextDate: string;
  endDate: string | null;
  note: string | null;
  accountId: string | null;
  accountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  active: boolean;
  lastRun: string | null;
}

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  message: string;
  refId: string | null;
  read: boolean;
  createdAt: string;
}

export interface DashboardData {
  period: { label: string; from: string; to: string };
  accounts: AccountWithBalance[];
  totalBalance: number;
  summary: PeriodSummary;
  receivables: number;
  payables: number;
  netPosition: number;
  budgetUsage: { totalLimit: number; totalUsed: number; percent: number; warnings: BudgetRow[] };
  upcoming: Array<{
    kind: string;
    id: string;
    title: string;
    amount: number | null;
    date: string;
    overdue: boolean;
  }>;
  charts: {
    dailyFlow: Array<{ date: string; income: number; expense: number }>;
    expenseByCategory: Array<{ name: string; value: number; icon?: string }>;
    monthlyTrend: Array<{ month: string; income: number; expense: number }>;
  };
  recent: TxnRow[];
  largestExpenses: TxnRow[];
  frequentCategories: Array<{ name: string; icon: string; count: number; total: number }>;
  peopleWithBalances: Array<{ id: string; name: string; receivable: number; payable: number }>;
  comparison: { income: number; expense: number } | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isDemo: boolean;
  onboarded: boolean;
  currency: string;
  warnThreshold: number;
}
