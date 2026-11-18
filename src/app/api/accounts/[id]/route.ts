import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getAccountsWithBalances } from "@/lib/server/data";

const patchSchema = z.object({
  name: z.string().min(1, "Name is required").max(60).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(30).optional(),
  archived: z.boolean().optional(),
  openingBalanceRupees: z.number().optional(),
  balanceRupees: z.number().optional(),
});

/** PATCH /api/accounts/[id] — rename / recolor / archive / update amount & balance. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.account.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Account not found");

    const data = parsed.data;

    const txnCount = await db.transaction.count({
      where: { userId: session.id, OR: [{ accountId: id }, { toAccountId: id }] },
    });

    let nextOpeningBalance = existing.openingBalance;

    // Direct opening balance edit if no transactions yet
    if (data.openingBalanceRupees !== undefined && txnCount === 0) {
      nextOpeningBalance = Math.round(data.openingBalanceRupees * 100);
    }

    // Direct balance edit
    if (data.balanceRupees !== undefined) {
      const targetPaisa = Math.round(data.balanceRupees * 100);
      if (txnCount === 0) {
        nextOpeningBalance = targetPaisa;
      } else {
        const accountsBefore = await getAccountsWithBalances(session.id);
        const currentAccount = accountsBefore.find((a) => a.id === id);
        const curBalance = currentAccount?.balance ?? existing.openingBalance;
        const diff = targetPaisa - curBalance;
        if (diff !== 0) {
          await db.transaction.create({
            data: {
              userId: session.id,
              type: "ADJUSTMENT",
              amount: Math.abs(diff),
              signed: diff > 0 ? 1 : -1,
              accountId: id,
              reason: `Balance updated to Rs ${Math.round(targetPaisa / 100).toLocaleString()}`,
              date: new Date(),
            },
          });
        }
      }
    }

    await db.account.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.archived !== undefined ? { archived: data.archived } : {}),
        openingBalance: nextOpeningBalance,
      },
    });

    const accounts = await getAccountsWithBalances(session.id);
    const account = accounts.find((a) => a.id === id);
    if (!account) throw new HttpError(404, "Account not found");
    return NextResponse.json({ account });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** DELETE /api/accounts/[id] — refused while transactions still reference it. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.account.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Account not found");

    const txnCount = await db.transaction.count({
      where: { userId: session.id, OR: [{ accountId: id }, { toAccountId: id }] },
    });
    if (txnCount > 0) throw new HttpError(400, "Move or delete its transactions first");

    await db.account.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
