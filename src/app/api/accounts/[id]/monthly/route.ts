import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getAccountsWithBalances } from "@/lib/server/data";
import { accountDelta, type TxnType } from "@/lib/raqamora/finance";
import type { AccountMonthlyRecord, AccountMonthlyResponse } from "@/lib/raqamora/types";

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function toKarachiMonth(date: Date): string {
  return new Date(date.getTime() + KARACHI_OFFSET_MS).toISOString().slice(0, 7);
}

function fmtMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
}

function shiftMonth(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 15));
  return d.toISOString().slice(0, 7);
}

/**
 * GET /api/accounts/[id]/monthly — Month-by-month progress & financial breakdown for this account.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;

    const [accountList, txns] = await Promise.all([
      getAccountsWithBalances(session.id),
      db.transaction.findMany({
        where: {
          userId: session.id,
          OR: [{ accountId: id }, { toAccountId: id }],
        },
        orderBy: { date: "asc" },
        select: {
          id: true,
          type: true,
          amount: true,
          signed: true,
          accountId: true,
          toAccountId: true,
          date: true,
        },
      }),
    ]);

    const account = accountList.find((a) => a.id === id);
    if (!account) throw new HttpError(404, "Account not found");

    const nowKarachi = new Date(Date.now() + KARACHI_OFFSET_MS);
    const currentMonth = nowKarachi.toISOString().slice(0, 7);

    // Build list of months to cover: at least past 6 months up to current month
    const monthKeysSet = new Set<string>();
    monthKeysSet.add(currentMonth);

    for (let i = 1; i <= 6; i++) {
      monthKeysSet.add(shiftMonth(currentMonth, -i));
    }

    // Also add any month that has transactions
    for (const t of txns) {
      monthKeysSet.add(toKarachiMonth(t.date));
    }

    // Sorted chronological ascending to compute running ending balances
    const sortedAscMonths = Array.from(monthKeysSet).sort();

    // Group transactions by month
    const txnsByMonth = new Map<string, typeof txns>();
    for (const t of txns) {
      const m = toKarachiMonth(t.date);
      const list = txnsByMonth.get(m) ?? [];
      list.push(t);
      txnsByMonth.set(m, list);
    }

    let runningBalance = account.openingBalance;
    const recordsMap = new Map<string, AccountMonthlyRecord>();

    for (const m of sortedAscMonths) {
      const monthTxns = txnsByMonth.get(m) ?? [];
      let inflow = 0;
      let outflow = 0;

      for (const t of monthTxns) {
        const isFrom = t.accountId === id;
        const isTo = t.toAccountId === id;
        const delta = isTo && t.type === "TRANSFER"
          ? t.amount
          : isFrom
            ? accountDelta(t.type as TxnType, t.amount, t.signed)
            : 0;

        if (delta > 0) {
          inflow += delta;
        } else if (delta < 0) {
          outflow += Math.abs(delta);
        }

        runningBalance += delta;
      }

      const net = inflow - outflow;
      const savingsRate = inflow > 0 ? Math.max(0, Math.round((net / inflow) * 100)) : 0;

      recordsMap.set(m, {
        month: m,
        monthLabel: fmtMonthLabel(m),
        inflow,
        outflow,
        net,
        endingBalance: runningBalance,
        txnCount: monthTxns.length,
        savingsRate,
      });
    }

    // Return descending (newest month first)
    const months = Array.from(recordsMap.values()).reverse();

    const response: AccountMonthlyResponse = {
      account,
      currentMonth,
      months,
    };

    return NextResponse.json(response);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
