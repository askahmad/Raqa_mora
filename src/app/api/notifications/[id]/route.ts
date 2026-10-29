import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";

const patchSchema = z.object({ read: z.boolean() });

/** PATCH /api/notifications/[id] — mark a single notification read/unread. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const existing = await db.notification.findFirst({ where: { id, userId: session.id } });
    if (!existing) throw new HttpError(404, "Notification not found");

    const updated = await db.notification.update({
      where: { id },
      data: { read: parsed.data.read },
    });

    return NextResponse.json({
      notification: {
        id: updated.id,
        kind: updated.kind,
        title: updated.title,
        message: updated.message,
        refId: updated.refId,
        read: updated.read,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
