import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { contributionSchema } from "@/lib/raqamora/validation";
import { mapGoal } from "@/app/api/_lib/rows";

const bodySchema = z.object({
  goalId: z.string().min(1, "Goal is required"),
  amountRupees: contributionSchema.shape.amountRupees,
  date: contributionSchema.shape.date,
  note: contributionSchema.shape.note,
});

/**
 * POST /api/goals/contribute — record a contribution to a savings goal.
 * Money does NOT leave any account: a contribution is a tracked intention,
 * not a transaction.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid contribution");

    const data = parsed.data;
    const goal = await db.savingsGoal.findFirst({ where: { id: data.goalId, userId: session.id } });
    if (!goal) throw new HttpError(404, "Goal not found");

    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");

    await db.contribution.create({
      data: {
        goalId: goal.id,
        amount: Math.round(data.amountRupees * 100),
        date,
        note: data.note?.trim() || null,
      },
    });

    const updated = await db.savingsGoal.findUnique({
      where: { id: goal.id },
      include: { contributions: true },
    });
    if (!updated) throw new HttpError(404, "Goal not found");
    return NextResponse.json({ goal: mapGoal(updated) }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
