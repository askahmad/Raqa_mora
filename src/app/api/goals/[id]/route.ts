import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { mapGoal } from "@/app/api/_lib/rows";

const patchSchema = z.object({
  name: z.string().min(1, "Name is required").max(80).optional(),
  targetAmountRupees: z.number().positive("Target must be greater than zero").max(1_000_000_000).optional(),
  targetDate: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

/** PATCH /api/goals/[id] — rename / retarget / annotate. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.savingsGoal.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Goal not found");

    const data = parsed.data;
    const update: Prisma.SavingsGoalUncheckedUpdateInput = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.targetAmountRupees !== undefined) update.targetAmount = Math.round(data.targetAmountRupees * 100);
    if (data.note !== undefined) update.note = data.note?.trim() || null;
    if (data.targetDate !== undefined) {
      if (data.targetDate === null) {
        update.targetDate = null;
      } else {
        const targetDate = new Date(data.targetDate);
        if (Number.isNaN(targetDate.getTime())) throw new HttpError(400, "Invalid target date");
        update.targetDate = targetDate;
      }
    }

    const updated = await db.savingsGoal.update({
      where: { id },
      data: update,
      include: { contributions: true },
    });
    return NextResponse.json({ goal: mapGoal(updated) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** DELETE /api/goals/[id] — deletes the goal and its contributions. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.savingsGoal.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Goal not found");

    await db.savingsGoal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
