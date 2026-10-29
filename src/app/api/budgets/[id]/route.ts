import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { karachiMonthRangeFromKey } from "@/app/api/_lib/dates";
import type { BudgetRow } from "@/lib/raqamora/types";

const patchSchema = z.object({
  amountRupees: z.number().positive("Budget must be greater than zero").max(1_000_000_000),
});

/** PATCH /api/budgets/[id] — change the monthly limit. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.budget.findFirst({
      where: { id, userId: session.id },
      include: { category: { select: { name: true, icon: true } } },
    });
    if (!existing) throw new HttpError(404, "Budget not found");

    const budget = await db.budget.update({
      where: { id },
      data: { amount: Math.round(parsed.data.amountRupees * 100) },
      include: { category: { select: { name: true, icon: true } } },
    });

    const { from, to } = karachiMonthRangeFromKey(budget.month);
    const grouped = await db.transaction.groupBy({
      by: ["categoryId"],
      where: { userId: session.id, type: "EXPENSE", categoryId: budget.categoryId, date: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    const used = grouped[0]?._sum.amount ?? 0;
    const row: BudgetRow = {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryIcon: budget.category.icon,
      amount: budget.amount,
      used,
      remaining: budget.amount - used,
      percent: budget.amount > 0 ? Math.round((used / budget.amount) * 100) : 0,
      month: budget.month,
    };
    return NextResponse.json({ budget: row });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** DELETE /api/budgets/[id] — remove the budget (transactions are untouched). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.budget.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Budget not found");

    await db.budget.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
