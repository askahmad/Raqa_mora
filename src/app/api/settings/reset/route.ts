import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/server/auth";

/**
 * POST /api/settings/reset — wipe ALL of the user's financial data while
 * keeping the login session. FK-safe order: transactions first (they restrict
 * accounts/debts), then contributions → goals → debts → budgets → recurring →
 * notifications → people → categories → accounts.
 */
export async function POST() {
  try {
    const session = await requireUser();
    await db.$transaction([
      db.transaction.deleteMany({ where: { userId: session.id } }),
      db.contribution.deleteMany({ where: { goal: { userId: session.id } } }),
      db.savingsGoal.deleteMany({ where: { userId: session.id } }),
      db.debt.deleteMany({ where: { userId: session.id } }),
      db.budget.deleteMany({ where: { userId: session.id } }),
      db.recurringRule.deleteMany({ where: { userId: session.id } }),
      db.notification.deleteMany({ where: { userId: session.id } }),
      db.person.deleteMany({ where: { userId: session.id } }),
      db.category.deleteMany({ where: { userId: session.id } }),
      db.account.deleteMany({ where: { userId: session.id } }),
      db.user.update({ where: { id: session.id }, data: { isDemo: false } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
