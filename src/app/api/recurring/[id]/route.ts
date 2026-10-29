import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { advanceKarachi } from "@/app/api/_lib/dates";
import { mapRecurringList } from "@/app/api/_lib/rows";

const patchSchema = z.object({
  active: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
  amountRupees: z.number().positive("Amount must be greater than zero").max(1_000_000_000).optional(),
  nextDate: z.string().optional(),
});

/** PATCH /api/recurring/[id] — active / note / amount / nextDate. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.recurringRule.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Recurring rule not found");

    const data = parsed.data;
    let nextDate: Date | undefined;
    if (data.nextDate !== undefined) {
      nextDate = new Date(data.nextDate);
      if (Number.isNaN(nextDate.getTime())) throw new HttpError(400, "Invalid next date");
    }

    const updated = await db.recurringRule.update({
      where: { id },
      data: {
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.note !== undefined ? { note: data.note?.trim() || null } : {}),
        ...(data.amountRupees !== undefined ? { amount: Math.round(data.amountRupees * 100) } : {}),
        ...(nextDate !== undefined ? { nextDate } : {}),
      },
    });

    const [recurring] = await mapRecurringList(session.id, [updated]);
    return NextResponse.json({ recurring });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** DELETE /api/recurring/[id] — remove the rule (already-created txns stay). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.recurringRule.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Recurring rule not found");

    await db.recurringRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
