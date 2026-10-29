import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/server/auth";
import { advanceKarachi } from "@/app/api/_lib/dates";

const MAX_CATCH_UP = 1000;

/**
 * POST /api/recurring/run — process every active rule whose nextDate is due.
 * For each due rule (inside its own transaction): re-read the rule, create the
 * scheduled transaction, then advance nextDate by the rule's frequency until
 * it is in the future and stamp lastRun. Re-reading inside the transaction
 * makes concurrent or repeated invocations idempotent.
 */
export async function POST() {
  try {
    const session = await requireUser();
    const now = new Date();
    const rules = await db.recurringRule.findMany({
      where: { userId: session.id, active: true },
      orderBy: { nextDate: "asc" },
    });

    let created = 0;
    for (const rule of rules) {
      await db.$transaction(async (tx) => {
        const fresh = await tx.recurringRule.findFirst({ where: { id: rule.id, userId: session.id } });
        if (!fresh || !fresh.active) return;
        if (fresh.nextDate.getTime() > now.getTime()) return; // nothing due
        if (fresh.endDate && fresh.nextDate.getTime() > fresh.endDate.getTime()) return; // past end

        await tx.transaction.create({
          data: {
            userId: session.id,
            type: fresh.type,
            amount: fresh.amount,
            signed: 1,
            date: fresh.nextDate,
            note: fresh.note?.trim() || fresh.title,
            accountId: fresh.accountId,
            toAccountId: fresh.type === "TRANSFER" ? fresh.toAccountId : null,
            categoryId: fresh.type === "TRANSFER" ? null : fresh.categoryId,
          },
        });

        let next = fresh.nextDate;
        let guard = 0;
        while (next.getTime() <= now.getTime() && guard < MAX_CATCH_UP) {
          next = advanceKarachi(next, fresh.frequency);
          guard++;
        }
        await tx.recurringRule.update({
          where: { id: fresh.id },
          data: { nextDate: next, lastRun: now },
        });
        created++;
      });
    }

    return NextResponse.json({ created });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
