import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getDebtsWithOutstanding } from "@/lib/server/data";
import { repaymentSchema } from "@/lib/raqamora/validation";
import { computeDebtOutstanding } from "@/lib/raqamora/finance";
import { formatRupees } from "@/lib/raqamora/money";

/**
 * POST /api/debts/repay — ATOMIC repayment. Re-reads the debt and its
 * repayments inside the transaction, rejects amounts above the outstanding
 * balance, records the REPAYMENT_* transaction and settles the debt when the
 * outstanding reaches zero.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = repaymentSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid repayment");

    const data = parsed.data;
    const account = await db.account.findFirst({ where: { id: data.accountId, userId: session.id } });
    if (!account) throw new HttpError(400, "Selected account was not found");
    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");
    const amount = Math.round(data.amountRupees * 100);

    await db.$transaction(async (tx) => {
      const debt = await tx.debt.findFirst({
        where: { id: data.debtId, userId: session.id },
        include: { transactions: { select: { type: true, amount: true } } },
      });
      if (!debt) throw new HttpError(404, "Debt not found");

      const repayments = debt.transactions.filter(
        (t) => t.type === "REPAYMENT_RECEIVED" || t.type === "REPAYMENT_MADE",
      );
      const outstanding = computeDebtOutstanding({ principal: debt.principal, direction: debt.direction }, repayments);
      if (outstanding <= 0) throw new HttpError(400, "This debt is already fully repaid");
      if (amount > outstanding) {
        throw new HttpError(
          400,
          `Repayment exceeds the outstanding amount — only Rs ${formatRupees(outstanding)} is left on this debt`,
        );
      }

      await tx.transaction.create({
        data: {
          userId: session.id,
          type: debt.direction === "RECEIVABLE" ? "REPAYMENT_RECEIVED" : "REPAYMENT_MADE",
          amount,
          signed: 1,
          date,
          note: data.note?.trim() || null,
          accountId: account.id,
          personId: debt.personId,
          debtId: debt.id,
        },
      });

      if (amount === outstanding) {
        await tx.debt.update({ where: { id: debt.id }, data: { status: "SETTLED" } });
      }
    });

    const debts = await getDebtsWithOutstanding(session.id);
    const debt = debts.find((d) => d.id === data.debtId);
    if (!debt) throw new HttpError(404, "Debt not found");

    return NextResponse.json({ debt }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
