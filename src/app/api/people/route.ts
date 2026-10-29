import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getDebtsWithOutstanding } from "@/lib/server/data";
import { personSchema } from "@/lib/raqamora/validation";
import type { PersonRow } from "@/lib/raqamora/types";

/** GET /api/people — people with outstanding receivable/payable aggregates. */
export async function GET() {
  try {
    const session = await requireUser();
    const [people, debts, activity] = await Promise.all([
      db.person.findMany({ where: { userId: session.id }, orderBy: { name: "asc" } }),
      getDebtsWithOutstanding(session.id),
      db.transaction.groupBy({
        by: ["personId"],
        where: { userId: session.id },
        _max: { date: true },
      }),
    ]);

    const lastActivity = new Map<string, Date>();
    for (const a of activity) {
      if (a.personId && a._max.date) lastActivity.set(a.personId, a._max.date);
    }

    const rows: PersonRow[] = people.map((p) => {
      const personDebts = debts.filter((d) => d.personId === p.id);
      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        notes: p.notes,
        receivableOutstanding: personDebts
          .filter((d) => d.direction === "RECEIVABLE")
          .reduce((s, d) => s + d.outstanding, 0),
        payableOutstanding: personDebts
          .filter((d) => d.direction === "PAYABLE")
          .reduce((s, d) => s + d.outstanding, 0),
        debtCount: personDebts.length,
        lastActivity: lastActivity.get(p.id)?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ people: rows });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** POST /api/people — create a person. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = personSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid person");

    const data = parsed.data;
    const created = await db.person.create({
      data: {
        userId: session.id,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        person: {
          id: created.id,
          name: created.name,
          phone: created.phone,
          notes: created.notes,
          receivableOutstanding: 0,
          payableOutstanding: 0,
          debtCount: 0,
          lastActivity: null,
        } satisfies PersonRow,
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
