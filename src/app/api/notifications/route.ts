import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/server/auth";
import type { NotificationRow } from "@/lib/raqamora/types";

/** GET /api/notifications — latest notifications + unread count. */
export async function GET() {
  try {
    const session = await requireUser();
    const [rows, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.notification.count({ where: { userId: session.id, read: false } }),
    ]);

    const notifications: NotificationRow[] = rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      message: n.message,
      refId: n.refId,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));

    return NextResponse.json({ notifications, unread: unreadCount });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
