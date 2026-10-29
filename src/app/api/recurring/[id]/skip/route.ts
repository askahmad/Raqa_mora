import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { advanceKarachi } from "@/app/api/_lib/dates";
import { mapRecurringList } from "@/app/api/_lib/rows";

/** POST /api/recurring/[id]/skip — push nextDate forward by one frequency. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const rule = await db.recurringRule.findFirst({ where: { id, userId: session.id } });
    if (!rule) throw new HttpError(404, "Recurring rule not found");

    const updated = await db.recurringRule.update({
      where: { id },
      data: { nextDate: advanceKarachi(rule.nextDate, rule.frequency) },
    });

    const [recurring] = await mapRecurringList(session.id, [updated]);
    return NextResponse.json({ recurring });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
