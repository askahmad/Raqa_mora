import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { categorySchema } from "@/lib/raqamora/validation";
import type { CategoryRow } from "@/lib/raqamora/types";

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

/** GET /api/categories — all categories with their transaction counts. */
export async function GET() {
  try {
    const session = await requireUser();
    const [categories, counts] = await Promise.all([
      db.category.findMany({ where: { userId: session.id }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: { userId: session.id },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map<string, number>();
    for (const c of counts) {
      if (c.categoryId) countMap.set(c.categoryId, c._count._all);
    }
    return NextResponse.json({ categories: categories.map((c) => toRow(c, countMap.get(c.id) ?? 0)) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** POST /api/categories — create a category. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid category");

    const data = parsed.data;
    const created = await db.category.create({
      data: { userId: session.id, name: data.name.trim(), kind: data.kind, icon: data.icon },
    });
    return NextResponse.json({ category: toRow(created, 0) }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
