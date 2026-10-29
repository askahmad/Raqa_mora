import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/server/auth";
import { mapTxn, txnWhere } from "@/lib/server/data";
import { karachiStamp } from "@/app/api/_lib/dates";
import { txnRels } from "@/app/api/_lib/rows";
import type { TxnRow } from "@/lib/raqamora/types";

function csvCell(value: string | null | undefined): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

function directionOrReason(t: TxnRow): string {
  if (t.type === "ADJUSTMENT") {
    return `${t.signed === -1 ? "DECREASE" : "INCREASE"}: ${t.reason ?? ""}`;
  }
  switch (t.type) {
    case "LENT":
      return t.personName ? `Lent to ${t.personName}` : "";
    case "BORROWED":
      return t.personName ? `Borrowed from ${t.personName}` : "";
    case "REPAYMENT_RECEIVED":
      return t.personName ? `Received from ${t.personName}` : "";
    case "REPAYMENT_MADE":
      return t.personName ? `Paid to ${t.personName}` : "";
    default:
      return "";
  }
}

/** GET /api/export/transactions — CSV download honouring the list filters. */
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

    const where = txnWhere(session.id, { q, type, categoryId, personId, from, to });
    if (accountId) {
      const accountCond = { OR: [{ accountId }, { toAccountId: accountId }] };
      const existing = Array.isArray(where.AND) ? (where.AND as unknown[]) : [];
      where.AND = [...existing, accountCond];
    }

    const rows = await db.transaction.findMany({
      where,
      include: txnRels,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10000,
    });

    const header = ["Date", "Type", "Amount (Rs)", "Account", "To Account", "Category", "Person", "Note", "Direction/Reason"];
    const lines = [header.map(csvCell).join(",")];
    for (const raw of rows) {
      const t = mapTxn(raw);
      lines.push(
        [
          csvCell(t.date),
          csvCell(t.type),
          csvCell((t.amount / 100).toFixed(2)),
          csvCell(t.accountName ?? ""),
          csvCell(t.toAccountName ?? ""),
          csvCell(t.categoryName ?? ""),
          csvCell(t.personName ?? ""),
          csvCell(t.note ?? ""),
          csvCell(directionOrReason(t)),
        ].join(","),
      );
    }

    const stamp = karachiStamp(new Date());
    return new NextResponse(lines.join("\r\n") + "\r\n", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="raqamora-transactions-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
