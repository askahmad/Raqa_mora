import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { mapTxn, txnWhere } from "@/lib/server/data";
import { transactionSchema } from "@/lib/raqamora/validation";
import { txnRels } from "@/app/api/_lib/rows";

const SORTS: Record<string, Array<Record<string, "asc" | "desc">>> = {
  date_asc: [{ date: "asc" }, { createdAt: "asc" }],
  date_desc: [{ date: "desc" }, { createdAt: "desc" }],
  amount_desc: [{ amount: "desc" }, { date: "desc" }],
  amount_asc: [{ amount: "asc" }, { date: "desc" }],
};

/** GET /api/transactions — filtered, searchable, paginated list. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const sp = req.nextUrl.searchParams;

    const q = sp.get("q")?.trim() || undefined;
    const type = sp.get("type") || undefined;
    const categoryId = sp.get("categoryId") || undefined;
    const accountId = sp.get("accountId") || undefined;
    const personId = sp.get("personId") || undefined;
    const from = sp.get("from") || undefined;
    const to = sp.get("to") || undefined;

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize")) || 25));
    const sortKey = sp.get("sort") || "date_desc";
    const orderBy = SORTS[sortKey] ?? SORTS["date_desc"];

    // txnWhere handles q/type/category/person/date filters; the account filter
    // is added via AND so it never collides with the q-driven OR clause.
    const where = txnWhere(session.id, { q, type, categoryId, personId, from, to });
    if (accountId) {
      const accountCond = { OR: [{ accountId }, { toAccountId: accountId }] };
      const existing = Array.isArray(where.AND) ? (where.AND as unknown[]) : [];
      where.AND = [...existing, accountCond];
    }

    const [total, rows] = await Promise.all([
      db.transaction.count({ where }),
      db.transaction.findMany({
        where,
        include: txnRels,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({ txns: rows.map(mapTxn), total, page, pageSize });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** POST /api/transactions — create a single transaction with validated references. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid transaction");
    }
    const data = parsed.data;

    // Verify every referenced record belongs to the session user.
    if (data.accountId) {
      const account = await db.account.findFirst({ where: { id: data.accountId, userId: session.id } });
      if (!account) throw new HttpError(400, "Selected account was not found");
    }
    if (data.toAccountId) {
      const toAccount = await db.account.findFirst({ where: { id: data.toAccountId, userId: session.id } });
      if (!toAccount) throw new HttpError(400, "Selected destination account was not found");
    }
    if (data.categoryId) {
      const category = await db.category.findFirst({ where: { id: data.categoryId, userId: session.id } });
      if (!category) throw new HttpError(400, "Selected category was not found");
    }
    if (data.personId) {
      const person = await db.person.findFirst({ where: { id: data.personId, userId: session.id } });
      if (!person) throw new HttpError(400, "Selected person was not found");
    }
    if (data.debtId) {
      const debt = await db.debt.findFirst({ where: { id: data.debtId, userId: session.id } });
      if (!debt) throw new HttpError(400, "Selected debt was not found");
    }

    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");

    const amount = Math.round(data.amountRupees * 100);
    const signed = data.type === "ADJUSTMENT" ? (data.adjustDirection === "DECREASE" ? -1 : 1) : 1;
    const reason = data.type === "ADJUSTMENT" ? (data.reason?.trim() || "Adjustment") : null;

    const created = await db.transaction.create({
      data: {
        userId: session.id,
        type: data.type,
        amount,
        signed,
        date,
        note: data.note?.trim() || null,
        reason,
        accountId: data.accountId ?? null,
        toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
        categoryId: data.type === "TRANSFER" ? null : data.categoryId ?? null,
        personId: data.personId ?? null,
        debtId: data.debtId ?? null,
      },
      include: txnRels,
    });

    return NextResponse.json({ txn: mapTxn(created) }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
