import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/server/auth";
import { karachiStamp } from "@/app/api/_lib/dates";

/** GET /api/export/backup — full JSON backup of every record the user owns. */
export async function GET() {
  try {
    const session = await requireUser();
    const [user, accounts, categories, people, transactions, debts, budgets, goals, recurring, notifications] =
      await Promise.all([
        db.user.findUnique({
          where: { id: session.id },
          select: {
            id: true, email: true, name: true, isDemo: true, onboarded: true,
            currency: true, locale: true, warnThreshold: true, createdAt: true,
          },
        }),
        db.account.findMany({ where: { userId: session.id }, orderBy: { createdAt: "asc" } }),
        db.category.findMany({ where: { userId: session.id }, orderBy: { createdAt: "asc" } }),
        db.person.findMany({ where: { userId: session.id }, orderBy: { createdAt: "asc" } }),
        db.transaction.findMany({ where: { userId: session.id }, orderBy: { date: "asc" } }),
        db.debt.findMany({ where: { userId: session.id }, orderBy: { createdAt: "asc" } }),
        db.budget.findMany({ where: { userId: session.id }, orderBy: { month: "asc" } }),
        db.savingsGoal.findMany({
          where: { userId: session.id },
          include: { contributions: { orderBy: { date: "asc" } } },
          orderBy: { createdAt: "asc" },
        }),
        db.recurringRule.findMany({ where: { userId: session.id }, orderBy: { nextDate: "asc" } }),
        db.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" } }),
      ]);

    const payload = {
      app: "RAQAMORA",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      moneyUnit: "paisa",
      user,
      accounts,
      categories,
      people,
      transactions,
      debts,
      budgets,
      goals,
      recurring,
      notifications,
    };

    const stamp = karachiStamp(new Date());
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="raqamora-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
