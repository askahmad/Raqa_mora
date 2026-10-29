import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { onboardingSchema } from "@/lib/raqamora/validation";

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const { name, accountName, accountType, openingBalanceRupees } = parsed.data;
    const openingPaisa = Math.round(openingBalanceRupees * 100);

    const [user] = await db.$transaction([
      db.user.update({ where: { id: session.id }, data: { name: name.trim(), onboarded: true } }),
      db.account.create({
        data: {
          userId: session.id,
          name: accountName.trim(),
          type: accountType,
          openingBalance: openingPaisa,
          icon: accountType === "CASH" ? "banknote" : "landmark",
        },
      }),
    ]);

    return NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name, isDemo: user.isDemo,
        onboarded: user.onboarded, currency: user.currency, warnThreshold: user.warnThreshold,
      },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
