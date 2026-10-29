import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getAccountsWithBalances } from "@/lib/server/data";
import { accountSchema } from "@/lib/raqamora/validation";

/** GET /api/accounts — all accounts with computed balances. */
export async function GET() {
  try {
    const session = await requireUser();
    const accounts = await getAccountsWithBalances(session.id);
    return NextResponse.json({ accounts });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** POST /api/accounts — create an account with an opening balance. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = accountSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid account");

    const data = parsed.data;
    const created = await db.account.create({
      data: {
        userId: session.id,
        name: data.name.trim(),
        type: data.type,
        openingBalance: Math.round(data.openingBalanceRupees * 100),
        color: data.color,
        icon: data.icon,
      },
    });

    return NextResponse.json(
      {
        account: {
          id: created.id,
          name: created.name,
          type: created.type,
          color: created.color,
          icon: created.icon,
          archived: created.archived,
          openingBalance: created.openingBalance,
          balance: created.openingBalance,
          txnCount: 0,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
