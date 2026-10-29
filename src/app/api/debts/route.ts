import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { getDebtsWithOutstanding } from "@/lib/server/data";
import { debtSchema } from "@/lib/raqamora/validation";

/** GET /api/debts?direction=RECEIVABLE|PAYABLE&status=ACTIVE|SETTLED */
export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const sp = req.nextUrl.searchParams;
    const direction = sp.get("direction");
    const status = sp.get("status");

    let debts = await getDebtsWithOutstanding(session.id);
    if (direction === "RECEIVABLE" || direction === "PAYABLE") {
      debts = debts.filter((d) => d.direction === direction);
    }
    if (status === "ACTIVE" || status === "SETTLED") {
      debts = debts.filter((d) => d.status === status);
    }
    return NextResponse.json({ debts });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/**
 * POST /api/debts — atomically create a Debt and, when `recordNow` is true,
 * the linked LENT/BORROWED transaction (rule 9 of the contract).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = debtSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid debt");

    const data = parsed.data;
    const person = await db.person.findFirst({ where: { id: data.personId, userId: session.id } });
    if (!person) throw new HttpError(400, "Selected person was not found");

    const principal = Math.round(data.principalRupees * 100);
    let dueDate: Date | null = null;
    if (data.dueDate) {
      dueDate = new Date(data.dueDate);
      if (Number.isNaN(dueDate.getTime())) throw new HttpError(400, "Invalid due date");
    }

    if (data.recordNow && !data.accountId) {
      throw new HttpError(400, "An account is required to record the transaction now");
    }
    let account: { id: string } | null = null;
    if (data.accountId) {
      account = await db.account.findFirst({ where: { id: data.accountId, userId: session.id } });
      if (!account) throw new HttpError(400, "Selected account was not found");
    }

    const debt = await db.$transaction(async (tx) => {
      const created = await tx.debt.create({
        data: {
          userId: session.id,
          personId: person.id,
          direction: data.direction,
          principal,
          note: data.note?.trim() || null,
          dueDate,
          status: "ACTIVE",
        },
      });
      if (data.recordNow && account) {
        await tx.transaction.create({
          data: {
            userId: session.id,
            type: data.direction === "RECEIVABLE" ? "LENT" : "BORROWED",
            amount: principal,
            signed: 1,
            date: new Date(),
            note:
              data.note?.trim() ||
              (data.direction === "RECEIVABLE" ? `Lent to ${person.name}` : `Borrowed from ${person.name}`),
            accountId: account.id,
            personId: person.id,
            debtId: created.id,
          },
        });
      }
      return created;
    });

    const debts = await getDebtsWithOutstanding(session.id);
    const mapped = debts.find((d) => d.id === debt.id);
    if (!mapped) throw new HttpError(500, "Debt was created but could not be loaded");
    return NextResponse.json({ debt: mapped }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
