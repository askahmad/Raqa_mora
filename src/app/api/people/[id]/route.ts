import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getDebtsWithOutstanding, mapTxn } from "@/lib/server/data";
import { personSchema } from "@/lib/raqamora/validation";
import { txnRels } from "@/app/api/_lib/rows";
import type { PersonRow } from "@/lib/raqamora/types";

async function personRow(userId: string, id: string): Promise<PersonRow> {
  const [person, debts, activity] = await Promise.all([
    db.person.findFirst({ where: { id, userId } }),
    getDebtsWithOutstanding(userId),
    db.transaction.aggregate({
      where: { userId, personId: id },
      _max: { date: true },
    }),
  ]);
  if (!person) throw new HttpError(404, "Person not found");

  const personDebts = debts.filter((d) => d.personId === id);
  return {
    id: person.id,
    name: person.name,
    phone: person.phone,
    notes: person.notes,
    receivableOutstanding: personDebts
      .filter((d) => d.direction === "RECEIVABLE")
      .reduce((s, d) => s + d.outstanding, 0),
    payableOutstanding: personDebts
      .filter((d) => d.direction === "PAYABLE")
      .reduce((s, d) => s + d.outstanding, 0),
    debtCount: personDebts.length,
    lastActivity: activity._max.date?.toISOString() ?? null,
  };
}

/** GET /api/people/[id] — person, their debts and their transactions. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const [person, debts] = await Promise.all([
      personRow(session.id, id),
      getDebtsWithOutstanding(session.id),
    ]);
    const txns = await db.transaction.findMany({
      where: { userId: session.id, personId: id },
      include: txnRels,
      orderBy: { date: "desc" },
      take: 100,
    });
    return NextResponse.json({
      person,
      debts: debts.filter((d) => d.personId === id),
      txns: txns.map(mapTxn),
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** PATCH /api/people/[id] — name / phone / notes. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = personSchema.partial().safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.person.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Person not found");

    const data = parsed.data;
    await db.person.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      },
    });

    const person = await personRow(session.id, id);
    return NextResponse.json({ person });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** DELETE /api/people/[id] — refused while debts or transactions reference them. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.person.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Person not found");

    const [debtCount, txnCount] = await Promise.all([
      db.debt.count({ where: { userId: session.id, personId: id } }),
      db.transaction.count({ where: { userId: session.id, personId: id } }),
    ]);
    if (debtCount > 0 || txnCount > 0) {
      throw new HttpError(400, "This person still has debts or transactions linked — remove those first");
    }

    await db.person.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
