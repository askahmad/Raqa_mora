import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { karachiMonthKey } from "@/lib/server/data";
import { karachiMonthRangeFromKey } from "@/app/api/_lib/dates";
import { budgetSchema } from "@/lib/raqamora/validation";
import type { BudgetRow } from "@/lib/raqamora/types";

/** Sum of EXPENSE per category within a date range (paisa). */
async function expenseUsedByCategory(
  userId: string,
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  const grouped = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, type: "EXPENSE", date: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  const map = new Map<string, number>();
  for (const g of grouped) {
    if (g.categoryId) map.set(g.categoryId, g._sum.amount ?? 0);
  }
  return map;
}

function toRow(
  budget: { id: string; categoryId: string; amount: number; month: string },
  category: { name: string; icon: string },
  used: number,
): BudgetRow {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    categoryName: category.name,
    categoryIcon: category.icon,
    amount: budget.amount,
    used,
    remaining: budget.amount - used,
    percent: budget.amount > 0 ? Math.round((used / budget.amount) * 100) : 0,
    month: budget.month,
  };
}

/** GET /api/budgets?month=YYYY-MM (defaults to the current Karachi month). */
export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const month = req.nextUrl.searchParams.get("month") || karachiMonthKey(new Date());
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Month must be in YYYY-MM format");

    const { from, to } = karachiMonthRangeFromKey(month);
    const [budgets, usedMap] = await Promise.all([
      db.budget.findMany({
        where: { userId: session.id, month },
        include: { category: { select: { name: true, icon: true } } },
        orderBy: { createdAt: "asc" },
      }),
      expenseUsedByCategory(session.id, from, to),
    ]);

    return NextResponse.json({
      budgets: budgets.map((b) => toRow(b, b.category, usedMap.get(b.categoryId) ?? 0)),
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** POST /api/budgets — upsert by (userId, categoryId, month). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = budgetSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid budget");

    const data = parsed.data;
    const category = await db.category.findFirst({
      where: { id: data.categoryId, userId: session.id },
    });
    if (!category) throw new HttpError(400, "Selected category was not found");
    if (category.kind !== "EXPENSE") throw new HttpError(400, "Budgets can only be set for expense categories");

    const amount = Math.round(data.amountRupees * 100);
    const budget = await db.budget.upsert({
      where: { userId_categoryId_month: { userId: session.id, categoryId: data.categoryId, month: data.month } },
      create: { userId: session.id, categoryId: data.categoryId, month: data.month, amount },
      update: { amount },
      include: { category: { select: { name: true, icon: true } } },
    });

    const { from, to } = karachiMonthRangeFromKey(budget.month);
    const usedMap = await expenseUsedByCategory(session.id, from, to);
    return NextResponse.json(
      { budget: toRow(budget, budget.category, usedMap.get(budget.categoryId) ?? 0) },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
