import { NextResponse } from "next/server";
import { getSessionUser, errorResponse } from "@/lib/server/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({ user });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
