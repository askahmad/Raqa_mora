/**
 * RAQAMORA API shared row mappers — turn Prisma rows into the contract shapes
 * from @/lib/raqamora/types.
 */
import { db } from "@/lib/db";
import type { GoalRow, RecurringRow } from "@/lib/raqamora/types";

/** Relation include that gives `mapTxn` (@/lib/server/data) everything it needs. */
export const txnRels = {
  account: { select: { name: true } },
  toAccount: { select: { name: true } },
  category: { select: { name: true, icon: true } },
  person: { select: { name: true } },
} as const;

export type RecurringRuleRow = {
  id: string;
  title: string;
  type: string;
  amount: number;
  frequency: string;
  nextDate: Date;
  endDate: Date | null;
  note: string | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  active: boolean;
  lastRun: Date | null;
};

export function mapRecurring(
  r: RecurringRuleRow,
  accountNames: Map<string, string>,
  categoryNames: Map<string, string>,
): RecurringRow {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    amount: r.amount,
    frequency: r.frequency,
    nextDate: r.nextDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    note: r.note,
    accountId: r.accountId,
    accountName: r.accountId ? accountNames.get(r.accountId) ?? null : null,
    toAccountId: r.toAccountId,
    toAccountName: r.toAccountId ? accountNames.get(r.toAccountId) ?? null : null,
    categoryId: r.categoryId,
    categoryName: r.categoryId ? categoryNames.get(r.categoryId) ?? null : null,
    active: r.active,
    lastRun: r.lastRun?.toISOString() ?? null,
  };
}

/**
 * Map recurring rules to RecurringRow[] resolving account/category names.
 * (RecurringRule stores scalar FKs only — no Prisma relations to include.)
 */
export async function mapRecurringList(
  userId: string,
  rules: RecurringRuleRow[],
): Promise<RecurringRow[]> {
  const [accounts, categories] = await Promise.all([
    db.account.findMany({ where: { userId }, select: { id: true, name: true } }),
    db.category.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  const accountNames = new Map(accounts.map((a) => [a.id, a.name] as const));
  const categoryNames = new Map(categories.map((c) => [c.id, c.name] as const));
  return rules.map((r) => mapRecurring(r, accountNames, categoryNames));
}

export type GoalWithContributions = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: Date | null;
  note: string | null;
  contributions: Array<{ id: string; amount: number; date: Date; note: string | null }>;
};

export function mapGoal(g: GoalWithContributions): GoalRow {
  const currentAmount = g.contributions.reduce((s, c) => s + c.amount, 0);
  return {
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    currentAmount,
    targetDate: g.targetDate?.toISOString() ?? null,
    note: g.note,
    percent: g.targetAmount > 0 ? Math.min(100, Math.round((currentAmount / g.targetAmount) * 100)) : 0,
    contributions: [...g.contributions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((c) => ({ id: c.id, amount: c.amount, date: c.date.toISOString(), note: c.note })),
  };
}
