import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie, errorResponse, HttpError } from "@/lib/server/auth";
import { signupSchema } from "@/lib/raqamora/validation";
import { DEFAULT_CATEGORIES } from "@/lib/raqamora/finance";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new HttpError(409, "An account with this email already exists");

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        categories: { create: DEFAULT_CATEGORIES.map((c) => ({ name: c.name, kind: c.kind, icon: c.icon })) },
      },
      select: { id: true, email: true, name: true, isDemo: true, onboarded: true, currency: true, warnThreshold: true },
    });
    await setSessionCookie(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
