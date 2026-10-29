import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/server/auth";
import { settingsSchema } from "@/lib/raqamora/validation";

/** PATCH /api/settings — update profile name and/or budget warning threshold. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireUser();
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid settings");

    const data = parsed.data;
    const user = await db.user.update({
      where: { id: session.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.warnThreshold !== undefined ? { warnThreshold: data.warnThreshold } : {}),
      },
      select: {
        id: true, email: true, name: true, isDemo: true, onboarded: true,
        currency: true, warnThreshold: true,
      },
    });

    return NextResponse.json({ user });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
