import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import type { CategoryRow } from "@/lib/raqamora/types";

const patchSchema = z.object({
  name: z.string().min(1, "Name is required").max(60).optional(),
  icon: z.string().max(30).optional(),
  archived: z.boolean().optional(),
});

function toRow(category: { id: string; name: string; kind: string; icon: string; archived: boolean }, txnCount: number): CategoryRow {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    icon: category.icon,
    archived: category.archived,
    txnCount,
  };
}

/** PATCH /api/categories/[id] — rename / re-icon / archive. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.category.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Category not found");

    const data = parsed.data;
    const updated = await db.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.archived !== undefined ? { archived: data.archived } : {}),
      },
    });

    const txnCount = await db.transaction.count({ where: { userId: session.id, categoryId: id } });
    return NextResponse.json({ category: toRow(updated, txnCount) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** DELETE /api/categories/[id] — refused when transactions exist (archive instead). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.category.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Category not found");

    const txnCount = await db.transaction.count({ where: { userId: session.id, categoryId: id } });
    if (txnCount > 0) throw new HttpError(400, "Category has transactions — archive it instead");

    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
