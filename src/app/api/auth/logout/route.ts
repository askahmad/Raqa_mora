import { NextResponse } from "next/server";
import { clearSessionCookie, errorResponse } from "@/lib/server/auth";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
