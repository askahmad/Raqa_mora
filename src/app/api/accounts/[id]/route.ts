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
});

/** PATCH /api/accounts/[id] — rename / recolor / archive. */
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
    await db.account.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.archived !== undefined ? { archived: data.archived } : {}),
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
