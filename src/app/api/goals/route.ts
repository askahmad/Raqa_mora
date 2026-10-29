import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { goalSchema } from "@/lib/raqamora/validation";
import { mapGoal } from "@/app/api/_lib/rows";

/** GET /api/goals — savings goals with contributions aggregated. */
export async function GET() {
  try {
    const session = await requireUser();
    const goals = await db.savingsGoal.findMany({
      where: { userId: session.id },
      include: { contributions: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ goals: goals.map(mapGoal) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** POST /api/goals — create a savings goal. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = goalSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid goal");

    const data = parsed.data;
    let targetDate: Date | null = null;
    if (data.targetDate) {
      targetDate = new Date(data.targetDate);
      if (Number.isNaN(targetDate.getTime())) throw new HttpError(400, "Invalid target date");
    }

    const created = await db.savingsGoal.create({
      data: {
        userId: session.id,
        name: data.name.trim(),
        targetAmount: Math.round(data.targetAmountRupees * 100),
        targetDate,
        note: data.note?.trim() || null,
      },
      include: { contributions: true },
    });

    return NextResponse.json({ goal: mapGoal(created) }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
