import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import {
  getAccountsWithBalances,
  getDebtsWithOutstanding,
  karachiDayRange,
  karachiMonthKey,
  karachiNow,
  mapTxn,
} from "@/lib/server/data";
import { computeNetPosition, computePeriodSummary } from "@/lib/raqamora/finance";
import {
  karachiDayKey,
  karachiMonthRangeFromKey,
  karachiMonthRange,
  karachiShift,
  karachiWeekRange,
  karachiYearRange,
} from "@/app/api/_lib/dates";
import { txnRels } from "@/app/api/_lib/rows";
import type { BudgetRow, DashboardData, TxnRow } from "@/lib/raqamora/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** GET /api/dashboard?range=today|week|month|year|custom&from&to */
export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const sp = req.nextUrl.searchParams;
    const range = sp.get("range") || "month";
    const now = new Date();
    const nowKarachi = karachiNow(); // shifted: UTC parts = Karachi wall clock

    let from: Date;
    let to: Date;
    let label: string;
    switch (range) {
      case "today": {
        ({ from, to } = karachiDayRange(nowKarachi));
        label = "Today";
        break;
      }
      case "week": {
        ({ from, to } = karachiWeekRange(nowKarachi));
        label = "This Week";
        break;
      }
      case "month": {
        ({ from, to } = karachiMonthRange(nowKarachi));
        label = "This Month";
        break;
      }
      case "year": {
        ({ from, to } = karachiYearRange(nowKarachi));
        label = "This Year";
        break;
      }
      case "custom": {
        const fromStr = sp.get("from");
        const toStr = sp.get("to");
        if (!fromStr || !toStr) throw new HttpError(400, "Custom range requires from and to dates");
        from = new Date(fromStr);
        to = new Date(toStr);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
          throw new HttpError(400, "Invalid custom range dates");
        }
        if (to.getTime() < from.getTime()) throw new HttpError(400, "Custom range end is before its start");
        label = "Custom Range";
        break;
      }
      default:
        throw new HttpError(400, "Invalid range — use today, week, month, year or custom");
    }

    const [periodRows, accounts, debts, recentRows] = await Promise.all([
      db.transaction.findMany({
        where: { userId: session.id, date: { gte: from, lte: to } },
        include: txnRels,
        orderBy: { date: "asc" },
      }),
      getAccountsWithBalances(session.id),
      getDebtsWithOutstanding(session.id),
      db.transaction.findMany({
        where: { userId: session.id },
        include: txnRels,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 8,
      }),
    ]);

    const periodTxns: TxnRow[] = periodRows.map(mapTxn);
    const recent: TxnRow[] = recentRows.map(mapTxn);
    const summary = computePeriodSummary(periodTxns);
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const receivables = debts
      .filter((d) => d.direction === "RECEIVABLE")
      .reduce((s, d) => s + d.outstanding, 0);
    const payables = debts
      .filter((d) => d.direction === "PAYABLE")
      .reduce((s, d) => s + d.outstanding, 0);
    const netPosition = computeNetPosition(accounts.map((a) => a.balance), debts);

    // ---- budgets (always the current Karachi month) ----
    const monthKey = karachiMonthKey(now);
    const monthBounds = karachiMonthRangeFromKey(monthKey);
    const [budgetRows, spentGroups] = await Promise.all([
      db.budget.findMany({
        where: { userId: session.id, month: monthKey },
        include: { category: { select: { name: true, icon: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: { userId: session.id, type: "EXPENSE", date: { gte: monthBounds.from, lte: monthBounds.to } },
        _sum: { amount: true },
      }),
    ]);
    const spentMap = new Map<string, number>();
    for (const g of spentGroups) {
      if (g.categoryId) spentMap.set(g.categoryId, g._sum.amount ?? 0);
    }
    const budgetRowsMapped: BudgetRow[] = budgetRows.map((b) => {
      const used = spentMap.get(b.categoryId) ?? 0;
      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        categoryIcon: b.category.icon,
        amount: b.amount,
        used,
        remaining: b.amount - used,
        percent: b.amount > 0 ? Math.round((used / b.amount) * 100) : 0,
        month: b.month,
      };
    });
    const totalLimit = budgetRowsMapped.reduce((s, b) => s + b.amount, 0);
    const totalUsed = budgetRowsMapped.reduce((s, b) => s + b.used, 0);
    const budgetUsage = {
      totalLimit,
      totalUsed,
      percent: totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0,
      warnings: budgetRowsMapped.filter((b) => b.percent >= session.warnThreshold),
    };

    // ---- upcoming: debts due in 30d (or overdue) + recurring due in 7d ----
    const horizon30 = now.getTime() + 30 * DAY_MS;
    const horizon7 = new Date(now.getTime() + 7 * DAY_MS);
    const upcoming: DashboardData["upcoming"] = [];
    for (const d of debts) {
      if (!d.dueDate || d.outstanding <= 0) continue;
      const due = new Date(d.dueDate).getTime();
      if (due <= horizon30) {
        upcoming.push({
          kind: "DEBT",
          id: d.id,
          title: `${d.personName} — ${d.direction === "RECEIVABLE" ? "owes you" : "you owe"}`,
          amount: d.outstanding,
          date: d.dueDate,
          overdue: due < now.getTime(),
        });
      }
    }
    const dueRules = await db.recurringRule.findMany({
      where: { userId: session.id, active: true, nextDate: { lte: horizon7 } },
      orderBy: { nextDate: "asc" },
    });
    for (const r of dueRules) {
      if (r.endDate && r.nextDate.getTime() > r.endDate.getTime()) continue;
      upcoming.push({
        kind: "RECURRING",
        id: r.id,
        title: r.title,
        amount: r.amount,
        date: r.nextDate.toISOString(),
        overdue: r.nextDate.getTime() < now.getTime(),
      });
    }
    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    // ---- charts ----
    // Day bucket grid on the Karachi calendar.
    const startMid = new Date(karachiShift(from));
    startMid.setUTCHours(0, 0, 0, 0);
    const endMid = new Date(karachiShift(to));
    endMid.setUTCHours(0, 0, 0, 0);
    const dayCount = Math.round((endMid.getTime() - startMid.getTime()) / DAY_MS) + 1;

    let dailyFlow: DashboardData["charts"]["dailyFlow"] = [];
    if (range !== "year") {
      if (dayCount <= 62) {
        const buckets = new Map<string, { income: number; expense: number }>();
        for (let i = 0; i < dayCount; i++) {
          buckets.set(new Date(startMid.getTime() + i * DAY_MS).toISOString().slice(0, 10), { income: 0, expense: 0 });
        }
        for (const t of periodTxns) {
          const bucket = buckets.get(karachiDayKey(new Date(t.date)));
          if (!bucket) continue;
          if (t.type === "INCOME") bucket.income += t.amount;
          else if (t.type === "EXPENSE") bucket.expense += t.amount;
        }
        dailyFlow = [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
      } else {
        // Long custom range: aggregate by month to keep the series readable.
        const monthly = new Map<string, { income: number; expense: number }>();
        let cursor = Date.UTC(startMid.getUTCFullYear(), startMid.getUTCMonth(), 1);
        const endMonthStart = Date.UTC(endMid.getUTCFullYear(), endMid.getUTCMonth(), 1);
        while (cursor <= endMonthStart) {
          monthly.set(new Date(cursor).toISOString().slice(0, 7), { income: 0, expense: 0 });
          cursor = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1);
        }
        for (const t of periodTxns) {
          const bucket = monthly.get(karachiDayKey(new Date(t.date)).slice(0, 7));
          if (!bucket) continue;
          if (t.type === "INCOME") bucket.income += t.amount;
          else if (t.type === "EXPENSE") bucket.expense += t.amount;
        }
        dailyFlow = [...monthly.entries()].map(([date, v]) => ({ date, ...v }));
      }
    }

    // Expense by category (refunds net off), top 8 + Other.
    const catNet = new Map<string, { name: string; icon: string; net: number }>();
    for (const t of periodTxns) {
      if (t.type !== "EXPENSE" && t.type !== "REFUND") continue;
      const key = t.categoryId ?? "uncategorized";
      const entry = catNet.get(key) ?? {
        name: t.categoryName ?? "Uncategorized",
        icon: t.categoryIcon ?? "tag",
        net: 0,
      };
      entry.net += t.type === "EXPENSE" ? t.amount : -t.amount;
      catNet.set(key, entry);
    }
    const topCats = [...catNet.values()]
      .filter((c) => c.net > 0)
      .sort((a, b) => b.net - a.net)
      .slice(0, 8);
    const topSum = topCats.reduce((s, c) => s + c.net, 0);
    const otherValue = Math.max(0, summary.netExpense - topSum);
    const expenseByCategory: DashboardData["charts"]["expenseByCategory"] = topCats.map((c) => ({
      name: c.name,
      value: c.net,
      icon: c.icon,
    }));
    if (otherValue > 0) expenseByCategory.push({ name: "Other", value: otherValue });

    // Monthly trend — last 6 Karachi months (all types counted for income/expense).
    const trendMonths: string[] = [];
    for (let i = 5; i >= 0; i--) {
      trendMonths.push(new Date(Date.UTC(endMid.getUTCFullYear(), endMid.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
    }
    const sixBounds = karachiMonthRangeFromKey(trendMonths[0]);
    const sixEnd = karachiMonthRangeFromKey(trendMonths[trendMonths.length - 1]);
    const trendTxns = await db.transaction.findMany({
      where: { userId: session.id, date: { gte: sixBounds.from, lte: sixEnd.to } },
      select: { type: true, amount: true, date: true },
    });
    const monthlyTrend = trendMonths.map((month) => {
      const bounds = karachiMonthRangeFromKey(month);
      let income = 0;
      let expense = 0;
      for (const t of trendTxns) {
        if (t.date < bounds.from || t.date > bounds.to) continue;
        if (t.type === "INCOME") income += t.amount;
        else if (t.type === "EXPENSE") expense += t.amount;
      }
      return { month, income, expense };
    });

    // ---- highlights ----
    const largestExpenses = periodTxns
      .filter((t) => t.type === "EXPENSE")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const freq = new Map<string, { name: string; icon: string; count: number; total: number }>();
    for (const t of periodTxns) {
      if (t.type !== "EXPENSE") continue;
      const key = t.categoryId ?? "uncategorized";
      const entry = freq.get(key) ?? {
        name: t.categoryName ?? "Uncategorized",
        icon: t.categoryIcon ?? "tag",
        count: 0,
        total: 0,
      };
      entry.count += 1;
      entry.total += t.amount;
      freq.set(key, entry);
    }
    const frequentCategories = [...freq.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    const peopleMap = new Map<string, { id: string; name: string; receivable: number; payable: number }>();
    for (const d of debts) {
      if (d.outstanding <= 0) continue;
      const entry = peopleMap.get(d.personId) ?? {
        id: d.personId,
        name: d.personName,
        receivable: 0,
        payable: 0,
      };
      if (d.direction === "RECEIVABLE") entry.receivable += d.outstanding;
      else entry.payable += d.outstanding;
      peopleMap.set(d.personId, entry);
    }
    const peopleWithBalances = [...peopleMap.values()]
      .filter((p) => p.receivable + p.payable > 0)
      .sort((a, b) => b.receivable + b.payable - (a.receivable + a.payable))
      .slice(0, 6);

    // ---- comparison: identical duration immediately before ----
    const durationMs = to.getTime() - from.getTime() + 1;
    const prevFrom = new Date(from.getTime() - durationMs);
    const prevTo = new Date(from.getTime() - 1);
    const prevTxns = await db.transaction.findMany({
      where: { userId: session.id, date: { gte: prevFrom, lte: prevTo } },
      select: { type: true, amount: true, signed: true },
    });
    const prevSummary = computePeriodSummary(prevTxns);

    const payload: DashboardData = {
      period: { label, from: from.toISOString(), to: to.toISOString() },
      accounts,
      totalBalance,
      summary,
      receivables,
      payables,
      netPosition,
      budgetUsage,
      upcoming,
      charts: { dailyFlow, expenseByCategory, monthlyTrend },
      recent,
      largestExpenses,
      frequentCategories,
      peopleWithBalances,
      comparison: { income: prevSummary.income, expense: prevSummary.expense },
    };

    return NextResponse.json(payload);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
