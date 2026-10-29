import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie, errorResponse, HttpError } from "@/lib/server/auth";
import { loginSchema } from "@/lib/raqamora/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");

    const email = parsed.data.email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      throw new HttpError(401, "Incorrect email or password");
    }
    await setSessionCookie(user.id);
    return NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name, isDemo: user.isDemo,
        onboarded: user.onboarded, currency: user.currency, warnThreshold: user.warnThreshold,
      },
    });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
