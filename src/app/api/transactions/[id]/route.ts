import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { mapTxn } from "@/lib/server/data";
import { txnRels } from "@/app/api/_lib/rows";

const patchSchema = z.object({
  amountRupees: z.number().positive("Amount must be greater than zero").max(1_000_000_000).optional(),
  date: z.string().optional(),
  note: z.string().max(500).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
});

/** PATCH /api/transactions/[id] — only amount/date/note/category/person are editable. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body: unknown = await req.json();

    const forbidden = ["type", "accountId", "toAccountId", "debtId", "reason", "signed", "adjustDirection"];
    if (body !== null && typeof body === "object" && forbidden.some((k) => k in (body as Record<string, unknown>))) {
      throw new HttpError(400, "Only amount, date, note, category and person can be edited");
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const txn = await db.transaction.findFirst({ where: { id, userId: session.id } });
    if (!txn) throw new HttpError(404, "Transaction not found");
    if (txn.debtId) throw new HttpError(400, "Debt-linked records cannot be edited here; use the debt instead");

    const data = parsed.data;
    const update: Prisma.TransactionUncheckedUpdateInput = {};

    if (data.amountRupees !== undefined) update.amount = Math.round(data.amountRupees * 100);
    if (data.date !== undefined) {
      const date = new Date(data.date);
      if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");
      update.date = date;
    }
    if (data.note !== undefined) update.note = data.note?.trim() || null;
    if (data.categoryId !== undefined) {
      if (data.categoryId === null) {
        update.categoryId = null;
      } else {
        const category = await db.category.findFirst({ where: { id: data.categoryId, userId: session.id } });
        if (!category) throw new HttpError(400, "Selected category was not found");
        update.categoryId = data.categoryId;
      }
    }
    if (data.personId !== undefined) {
      if (data.personId === null) {
        update.personId = null;
      } else {
        const person = await db.person.findFirst({ where: { id: data.personId, userId: session.id } });
        if (!person) throw new HttpError(400, "Selected person was not found");
        update.personId = data.personId;
      }
    }

    const updated = await db.transaction.update({
      where: { id },
      data: update,
      include: txnRels,
    });
    return NextResponse.json({ txn: mapTxn(updated) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE /api/transactions/[id] — debt-linked LENT/BORROWED rows are protected
 * (delete the debt instead). REPAYMENT_* rows may be deleted, which restores
 * the debt's outstanding automatically (outstanding is derived).
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const txn = await db.transaction.findFirst({ where: { id, userId: session.id } });
    if (!txn) throw new HttpError(404, "Transaction not found");

    const isRepayment = txn.type === "REPAYMENT_RECEIVED" || txn.type === "REPAYMENT_MADE";
    if (txn.debtId && !isRepayment) {
      throw new HttpError(400, "Linked debt records cannot be deleted; delete the debt instead");
    }

    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
