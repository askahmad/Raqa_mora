import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { mapTxn } from "@/lib/server/data";
import { accountDelta, computePeriodSummary, type TxnType } from "@/lib/raqamora/finance";
import { karachiDayKey, karachiShift, KARACHI_OFFSET_MS } from "@/app/api/_lib/dates";
import { txnRels } from "@/app/api/_lib/rows";
import type { PeriodSummary, TxnRow } from "@/lib/raqamora/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/reports?from&to — full analytical report for an inclusive ISO date
 * range, bucketed on the Asia/Karachi calendar.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const sp = req.nextUrl.searchParams;
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    if (!fromStr || !toStr) throw new HttpError(400, "from and to dates are required");
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new HttpError(400, "Invalid from/to dates");
    }
    if (to.getTime() < from.getTime()) throw new HttpError(400, "Range end is before its start");

    const [periodRows, accounts, cashTxns, debts] = await Promise.all([
      db.transaction.findMany({
        where: { userId: session.id, date: { gte: from, lte: to } },
        include: txnRels,
        orderBy: { date: "asc" },
      }),
      db.account.findMany({ where: { userId: session.id }, select: { id: true, name: true, openingBalance: true } }),
      db.transaction.findMany({
        where: { userId: session.id, date: { lte: to } },
        select: { type: true, amount: true, signed: true, date: true },
      }),
      db.debt.findMany({
        where: { userId: session.id },
        select: {
          principal: true,
          direction: true,
          createdAt: true,
          transactions: { select: { type: true, amount: true, date: true } },
        },
      }),
    ]);

    const txns: TxnRow[] = periodRows.map(mapTxn);
    const summary: PeriodSummary = computePeriodSummary(txns);

    // ---- Karachi day grid ----
    const startMid = new Date(karachiShift(from));
    startMid.setUTCHours(0, 0, 0, 0);
    const endMid = new Date(karachiShift(to));
    endMid.setUTCHours(0, 0, 0, 0);

    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (let t = startMid.getTime(); t <= endMid.getTime(); t += DAY_MS) {
      dailyMap.set(new Date(t).toISOString().slice(0, 10), { income: 0, expense: 0 });
    }

    // ---- Karachi week grid (Monday start) ----
    const startDow = startMid.getUTCDay();
    const firstMonday = startMid.getTime() - ((startDow + 6) % 7) * DAY_MS;
    const weeklyMap = new Map<string, { income: number; expense: number }>();
    for (let t = firstMonday; t <= endMid.getTime(); t += 7 * DAY_MS) {
      weeklyMap.set(new Date(t).toISOString().slice(0, 10), { income: 0, expense: 0 });
    }

    // ---- Karachi month grid ----
    const monthsList: Array<{ y: number; m: number }> = [];
    {
      let y = startMid.getUTCFullYear();
      let m = startMid.getUTCMonth();
      for (;;) {
        monthsList.push({ y, m });
        if (y === endMid.getUTCFullYear() && m === endMid.getUTCMonth()) break;
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
        if (monthsList.length > 2400) break; // safety valve
      }
    }
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (const { y, m } of monthsList) {
      monthlyMap.set(`${y}-${String(m + 1).padStart(2, "0")}`, { income: 0, expense: 0 });
    }

    for (const t of txns) {
      const dayKey = karachiDayKey(new Date(t.date));
      if (t.type === "INCOME" || t.type === "EXPENSE") {
        const day = dailyMap.get(dayKey);
        if (day) {
          if (t.type === "INCOME") day.income += t.amount;
          else day.expense += t.amount;
        }
        const week = weeklyMap.get(dayKey);
        if (week) {
          if (t.type === "INCOME") week.income += t.amount;
          else week.expense += t.amount;
        }
        const month = monthlyMap.get(dayKey.slice(0, 7));
        if (month) {
          if (t.type === "INCOME") month.income += t.amount;
          else month.expense += t.amount;
        }
      }
    }

    const daily = [...dailyMap.entries()].map(([date, v]) => ({ date, ...v }));
    const weekly = [...weeklyMap.entries()].map(([week, v]) => ({ week, ...v }));
    const monthly = [...monthlyMap.entries()].map(([month, v]) => ({ month, ...v }));

    // ---- byCategory (INCOME positive; EXPENSE net of refunds) ----
    type CatAgg = { name: string; kind: string; total: number; count: number };
    const catAgg = new Map<string, CatAgg>();
    for (const t of txns) {
      if (t.type !== "INCOME" && t.type !== "EXPENSE" && t.type !== "REFUND") continue;
      const key = `${t.categoryId ?? "uncategorized"}:${t.type === "INCOME" ? "INCOME" : "EXPENSE"}`;
      const entry = catAgg.get(key) ?? {
        name: t.categoryName ?? "Uncategorized",
        kind: t.type === "INCOME" ? "INCOME" : "EXPENSE",
        total: 0,
        count: 0,
      };
      entry.total += t.type === "INCOME" ? t.amount : t.type === "EXPENSE" ? t.amount : -t.amount;
      entry.count += 1;
      catAgg.set(key, entry);
    }
    const byCategory = [...catAgg.values()]
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    // ---- byAccount (inflow/outflow from account deltas) ----
    const accMap = new Map<string, { name: string; inflow: number; outflow: number }>();
    const ensureAcc = (id: string) => {
      const existing = accMap.get(id);
      if (existing) return existing;
      const created = { name: accounts.find((a) => a.id === id)?.name ?? "Account", inflow: 0, outflow: 0 };
      accMap.set(id, created);
      return created;
    };
    for (const t of txns) {
      if (t.type === "TRANSFER") {
        if (t.accountId) ensureAcc(t.accountId).outflow += t.amount;
        if (t.toAccountId) ensureAcc(t.toAccountId).inflow += t.amount;
        continue;
      }
      if (!t.accountId) continue;
      const delta = accountDelta(t.type as TxnType, t.amount, t.signed);
      if (delta > 0) ensureAcc(t.accountId).inflow += delta;
      else if (delta < 0) ensureAcc(t.accountId).outflow += -delta;
    }
    const byAccount = [...accMap.values()].sort(
      (a, b) => b.inflow + b.outflow - (a.inflow + a.outflow),
    );

    // ---- repayment history + largest expenses ----
    const repaymentHistory = txns
      .filter((t) => t.type === "REPAYMENT_RECEIVED" || t.type === "REPAYMENT_MADE")
      .sort((a, b) => b.date.localeCompare(a.date));
    const largest = txns
      .filter((t) => t.type === "EXPENSE")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // ---- net position trend (month-end approximation) ----
    const sortedCash = [...cashTxns].sort((a, b) => a.date.getTime() - b.date.getTime());
    const openingSum = accounts.reduce((s, a) => s + a.openingBalance, 0);
    const netPositionTrend: Array<{ month: string; netPosition: number }> = [];
    let ptr = 0;
    let runningDelta = 0;
    for (const { y, m } of monthsList) {
      const boundary = Date.UTC(y, m + 1, 1) - KARACHI_OFFSET_MS; // exclusive end of month (real instant)
      while (ptr < sortedCash.length && sortedCash[ptr].date.getTime() < boundary) {
        const t = sortedCash[ptr];
        if (t.type !== "TRANSFER") {
          runningDelta += accountDelta(t.type as TxnType, t.amount, t.signed);
        }
        ptr++;
      }
      const cash = openingSum + runningDelta;
      let receivable = 0;
      let payable = 0;
      for (const d of debts) {
        if (d.createdAt.getTime() >= boundary) continue;
        const repaid = d.transactions
          .filter(
            (r) =>
              (r.type === "REPAYMENT_RECEIVED" || r.type === "REPAYMENT_MADE") &&
              r.date.getTime() < boundary,
          )
          .reduce((s, r) => s + r.amount, 0);
        const outstanding = Math.max(0, d.principal - repaid);
        if (d.direction === "RECEIVABLE") receivable += outstanding;
        else payable += outstanding;
      }
      netPositionTrend.push({
        month: `${y}-${String(m + 1).padStart(2, "0")}`,
        netPosition: cash + receivable - payable,
      });
    }

    return NextResponse.json({
      summary,
      daily,
      weekly,
      monthly,
      byCategory,
      byAccount,
      repaymentHistory,
      largest,
      netPositionTrend,
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
