/**
 * RAQAMORA server data layer — one place where account balances, debt
 * outstanding amounts and summaries are computed using the shared finance
 * domain rules. All routes must use these helpers (never re-implement).
 */
import { db } from "@/lib/db";
import {
  accountDelta,
  computeDebtOutstanding,
  type TxnType,
} from "@/lib/raqamora/finance";
import type { AccountWithBalance, DebtWithOutstanding, TxnRow } from "@/lib/raqamora/types";

export async function getAccountsWithBalances(userId: string): Promise<AccountWithBalance[]> {
  const [accounts, txns] = await Promise.all([
    db.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.transaction.findMany({
      where: { userId },
      select: { type: true, amount: true, signed: true, accountId: true, toAccountId: true, date: true },
    }),
  ]);

  const nowKarachi = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const currentMonthKey = nowKarachi.toISOString().slice(0, 7);

  return accounts.map((a) => {
    let thisMonthInflow = 0;
    let thisMonthOutflow = 0;

    const balance = a.openingBalance + txns.reduce((sum, t) => {
      const isFrom = t.accountId === a.id;
      const isTo = t.toAccountId === a.id;
      const delta = isTo && t.type === "TRANSFER"
        ? t.amount
        : isFrom
          ? accountDelta(t.type as TxnType, t.amount, t.signed)
          : 0;

      // Track this month's inflow and outflow for progress tracking
      if (delta !== 0) {
        const tMonth = new Date(t.date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 7);
        if (tMonth === currentMonthKey) {
          if (delta > 0) {
            thisMonthInflow += delta;
          } else {
            thisMonthOutflow += Math.abs(delta);
          }
        }
      }

      return sum + delta;
    }, 0);

    return {
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color,
      icon: a.icon,
      archived: a.archived,
      openingBalance: a.openingBalance,
      balance,
      txnCount: txns.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length,
      createdAt: a.createdAt.toISOString(),
      thisMonthInflow,
      thisMonthOutflow,
      thisMonthNet: thisMonthInflow - thisMonthOutflow,
    };
  });
}

export async function getDebtsWithOutstanding(userId: string): Promise<DebtWithOutstanding[]> {
  const debts = await db.debt.findMany({
    where: { userId },
    include: { person: { select: { name: true } }, transactions: { select: { amount: true, type: true } } },
    orderBy: { createdAt: "desc" },
  });
  return debts.map((d) => {
    const repayments = d.transactions.filter(
      (t) => t.type === "REPAYMENT_RECEIVED" || t.type === "REPAYMENT_MADE",
    );
    const repaid = repayments.reduce((s, r) => s + r.amount, 0);
    const outstanding = computeDebtOutstanding({ principal: d.principal, direction: d.direction }, repayments);
    const status = outstanding === 0 ? "SETTLED" : d.status;
    return {
      id: d.id,
      personId: d.personId,
      personName: d.person.name,
      direction: d.direction,
      principal: d.principal,
      repaid,
      outstanding,
      dueDate: d.dueDate?.toISOString() ?? null,
      status,
      note: d.note,
      createdAt: d.createdAt.toISOString(),
    };
  });
}

const txnInclude = {
  account: { select: { name: true } },
  toAccount: { select: { name: true } },
  category: { select: { name: true, icon: true } },
  person: { select: { name: true } },
} as const;

type TxnWithRels = {
  id: string; type: string; amount: number; signed: number; date: Date; note: string | null;
  reason: string | null; accountId: string | null; toAccountId: string | null;
  categoryId: string | null; personId: string | null; debtId: string | null; createdAt: Date;
  account?: { name: string } | null; toAccount?: { name: string } | null;
  category?: { name: string; icon: string } | null; person?: { name: string } | null;
};

export function mapTxn(t: TxnWithRels): TxnRow {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    signed: t.signed,
    date: t.date.toISOString(),
    note: t.note,
    reason: t.reason,
    accountId: t.accountId,
    accountName: t.account?.name ?? null,
    toAccountId: t.toAccountId,
    toAccountName: t.toAccount?.name ?? null,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    categoryIcon: t.category?.icon ?? null,
    personId: t.personId,
    personName: t.person?.name ?? null,
    debtId: t.debtId,
    createdAt: t.createdAt.toISOString(),
  };
}

export function txnWhere(userId: string, filters: {
  q?: string; type?: string; categoryId?: string; accountId?: string; personId?: string;
  from?: string; to?: string;
}) {
  const where: Record<string, unknown> = { userId };
  if (filters.type) where.type = filters.type;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.accountId) where.OR = [{ accountId: filters.accountId }, { toAccountId: filters.accountId }];
  if (filters.personId) where.personId = filters.personId;
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) (where.date as Record<string, Date>).gte = new Date(filters.from);
    if (filters.to) (where.date as Record<string, Date>).lte = new Date(filters.to);
  }
  if (filters.q) where.OR = [{ note: { contains: filters.q } }, { reason: { contains: filters.q } }];
  return where;
}

/** Fixed "today" basis in Asia/Karachi for consistent day boundaries. */
export function karachiNow(): Date {
  const now = new Date();
  const karachi = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return karachi;
}

export function karachiDayRange(d: Date): { from: Date; to: Date } {
  const day = new Date(d);
  day.setUTCHours(0, 0, 0, 0);
  const to = new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { from: new Date(day.getTime() - 5 * 60 * 60 * 1000), to: new Date(to.getTime() - 5 * 60 * 60 * 1000) };
}

/** YYYY-MM for a Date in Karachi time. */
export function karachiMonthKey(d: Date): string {
  const k = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  return k.toISOString().slice(0, 7);
}
