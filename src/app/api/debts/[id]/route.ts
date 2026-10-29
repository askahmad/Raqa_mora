import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getDebtsWithOutstanding, mapTxn } from "@/lib/server/data";
import { txnRels } from "@/app/api/_lib/rows";

const patchSchema = z.object({
  note: z.string().max(500).nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

async function loadDebt(userId: string, id: string) {
  const debts = await getDebtsWithOutstanding(userId);
  const debt = debts.find((d) => d.id === id);
  if (!debt) throw new HttpError(404, "Debt not found");
  return debt;
}

/** GET /api/debts/[id] — debt detail with its repayment transactions. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const debt = await loadDebt(session.id, id);

    const repayments = await db.transaction.findMany({
      where: { debtId: id, type: { in: ["REPAYMENT_RECEIVED", "REPAYMENT_MADE"] } },
      include: txnRels,
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ debt, repayments: repayments.map(mapTxn) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** PATCH /api/debts/[id] — note and dueDate only. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.debt.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Debt not found");

    const data = parsed.data;
    const update: Prisma.DebtUncheckedUpdateInput = {};
    if (data.note !== undefined) update.note = data.note?.trim() || null;
    if (data.dueDate !== undefined) {
      if (data.dueDate === null) {
        update.dueDate = null;
      } else {
        const due = new Date(data.dueDate);
        if (Number.isNaN(due.getTime())) throw new HttpError(400, "Invalid due date");
        update.dueDate = due;
      }
    }

    await db.debt.update({ where: { id }, data: update });
    const debt = await loadDebt(session.id, id);
    return NextResponse.json({ debt });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE /api/debts/[id] — only allowed while the debt has no repayments.
 * The linked LENT/BORROWED transaction is removed atomically with the debt.
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const debt = await db.debt.findFirst({ where: { id, userId: session.id } });
    if (!debt) throw new HttpError(404, "Debt not found");

    await db.$transaction(async (tx) => {
      const repaymentCount = await tx.transaction.count({
        where: { debtId: id, type: { in: ["REPAYMENT_RECEIVED", "REPAYMENT_MADE"] } },
      });
      if (repaymentCount > 0) {
        throw new HttpError(400, "This debt has repayments recorded — delete the repayment transactions first");
      }
      await tx.transaction.deleteMany({ where: { debtId: id } });
      await tx.debt.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
