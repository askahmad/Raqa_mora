import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/server/auth";
import { karachiMonthKey } from "@/lib/server/data";
import { karachiDayKey, karachiMonthRangeFromKey } from "@/app/api/_lib/dates";
import { formatRupees } from "@/lib/raqamora/money";
import type { BudgetRow } from "@/lib/raqamora/types";

const DAY_MS = 24 * 60 * 60 * 1000;

type Draft = { kind: string; title: string; message: string; refId: string | null };

/**
 * POST /api/notifications/generate — recompute actionable alerts:
 * budget warnings (>= user threshold), overdue debts, debts due within 7 days
 * and recurring rules due within 3 days. A notification is only created when
 * no unread one with the same (kind, refId) already exists.
 */
export async function POST() {
  try {
    const session = await requireUser();
    const now = new Date();
    const monthKey = karachiMonthKey(now);
    const monthBounds = karachiMonthRangeFromKey(monthKey);

    const [budgetRows, spentGroups, debts, rules, existingUnread] = await Promise.all([
      db.budget.findMany({
        where: { userId: session.id, month: monthKey },
        include: { category: { select: { name: true } } },
      }),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: { userId: session.id, type: "EXPENSE", date: { gte: monthBounds.from, lte: monthBounds.to } },
        _sum: { amount: true },
      }),
      db.debt.findMany({
        where: { userId: session.id },
        include: { transactions: { select: { type: true, amount: true } }, person: { select: { name: true } } },
      }),
      db.recurringRule.findMany({ where: { userId: session.id, active: true } }),
      db.notification.findMany({ where: { userId: session.id, read: false }, select: { kind: true, refId: true } }),
    ]);

    const seen = new Set(existingUnread.map((n) => `${n.kind}:${n.refId ?? ""}`));
    const drafts: Draft[] = [];
    const push = (draft: Draft) => {
      const key = `${draft.kind}:${draft.refId ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      drafts.push(draft);
    };

    // ---- budgets ----
    const spentMap = new Map<string, number>();
    for (const g of spentGroups) {
      if (g.categoryId) spentMap.set(g.categoryId, g._sum.amount ?? 0);
    }
    const budgetWarnings: BudgetRow[] = budgetRows.map((b) => {
      const used = spentMap.get(b.categoryId) ?? 0;
      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        categoryIcon: "",
        amount: b.amount,
        used,
        remaining: b.amount - used,
        percent: b.amount > 0 ? Math.round((used / b.amount) * 100) : 0,
        month: b.month,
      };
    });
    for (const b of budgetWarnings) {
      if (b.percent < session.warnThreshold) continue;
      if (b.percent >= 100) {
        push({
          kind: "BUDGET_OVER",
          title: `Budget exceeded: ${b.categoryName}`,
          message: `Your ${b.categoryName} budget for ${b.month} is ${b.percent}% used (Rs ${formatRupees(b.used)} of Rs ${formatRupees(b.amount)}).`,
          refId: b.id,
        });
      } else {
        push({
          kind: "BUDGET_WARN",
          title: `Budget warning: ${b.categoryName}`,
          message: `Your ${b.categoryName} budget for ${b.month} is ${b.percent}% used (Rs ${formatRupees(b.used)} of Rs ${formatRupees(b.amount)}).`,
          refId: b.id,
        });
      }
    }

    // ---- debts: overdue + due within 7 days ----
    const horizon7 = now.getTime() + 7 * DAY_MS;
    for (const d of debts) {
      if (!d.dueDate) continue;
      const repayments = d.transactions.filter(
        (t) => t.type === "REPAYMENT_RECEIVED" || t.type === "REPAYMENT_MADE",
      );
      const outstanding = Math.max(0, d.principal - repayments.reduce((s, r) => s + r.amount, 0));
      if (outstanding <= 0) continue;
      const due = d.dueDate.getTime();
      const dueDay = karachiDayKey(d.dueDate);
      const amount = `Rs ${formatRupees(outstanding)}`;
      if (due < now.getTime()) {
        push({
          kind: "DEBT_OVERDUE",
          title: d.direction === "RECEIVABLE" ? "Repayment overdue" : "Payment overdue",
          message:
            d.direction === "RECEIVABLE"
              ? `${d.person.name} still owes ${amount} — was due on ${dueDay}.`
              : `Your ${amount} debt to ${d.person.name} was due on ${dueDay}.`,
          refId: d.id,
        });
      } else if (due <= horizon7) {
        push({
          kind: "DEBT_DUE",
          title: d.direction === "RECEIVABLE" ? "Repayment due soon" : "Payment due soon",
          message:
            d.direction === "RECEIVABLE"
              ? `${d.person.name} owes ${amount} — due on ${dueDay}.`
              : `You owe ${d.person.name} ${amount} — due on ${dueDay}.`,
          refId: d.id,
        });
      }
    }

    // ---- recurring rules due within 3 days ----
    const horizon3 = now.getTime() + 3 * DAY_MS;
    for (const r of rules) {
      if (r.nextDate.getTime() > horizon3) continue;
      if (r.endDate && r.nextDate.getTime() > r.endDate.getTime()) continue;
      push({
        kind: "RECURRING_DUE",
        title: `${r.title} is due`,
        message: `${r.title} (${r.frequency.toLowerCase()}) is scheduled for ${karachiDayKey(r.nextDate)}.`,
        refId: r.id,
      });
    }

    if (drafts.length > 0) {
      await db.notification.createMany({
        data: drafts.map((d) => ({
          userId: session.id,
          kind: d.kind,
          title: d.title,
          message: d.message,
          refId: d.refId,
        })),
      });
    }

    return NextResponse.json({ created: drafts.length });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
