import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { recurringSchema } from "@/lib/raqamora/validation";
import { mapRecurringList } from "@/app/api/_lib/rows";

/** GET /api/recurring — all recurring rules, soonest first. */
export async function GET() {
  try {
    const session = await requireUser();
    const rules = await db.recurringRule.findMany({
      where: { userId: session.id },
      orderBy: { nextDate: "asc" },
    });
    return NextResponse.json({ recurring: await mapRecurringList(session.id, rules) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** POST /api/recurring — create a recurring rule with validated references. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = recurringSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid recurring rule");

    const data = parsed.data;
    if (data.accountId) {
      const account = await db.account.findFirst({ where: { id: data.accountId, userId: session.id } });
      if (!account) throw new HttpError(400, "Selected account was not found");
    }
    if (data.toAccountId) {
      const toAccount = await db.account.findFirst({ where: { id: data.toAccountId, userId: session.id } });
      if (!toAccount) throw new HttpError(400, "Selected destination account was not found");
    }
    if (data.categoryId) {
      const category = await db.category.findFirst({ where: { id: data.categoryId, userId: session.id } });
      if (!category) throw new HttpError(400, "Selected category was not found");
    }

    const nextDate = new Date(data.nextDate);
    if (Number.isNaN(nextDate.getTime())) throw new HttpError(400, "Invalid next date");
    let endDate: Date | null = null;
    if (data.endDate) {
      endDate = new Date(data.endDate);
      if (Number.isNaN(endDate.getTime())) throw new HttpError(400, "Invalid end date");
    }

    const created = await db.recurringRule.create({
      data: {
        userId: session.id,
        title: data.title.trim(),
        type: data.type,
        amount: Math.round(data.amountRupees * 100),
        frequency: data.frequency,
        nextDate,
        endDate,
        note: data.note?.trim() || null,
        accountId: data.accountId ?? null,
        toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
        categoryId: data.type === "TRANSFER" ? null : data.categoryId,
        active: true,
      },
    });

    const [recurring] = await mapRecurringList(session.id, [created]);
    return NextResponse.json({ recurring }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
