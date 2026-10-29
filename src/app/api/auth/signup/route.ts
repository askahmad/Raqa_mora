import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie, errorResponse, HttpError } from "@/lib/server/auth";
import { signupSchema } from "@/lib/raqamora/validation";

const DEFAULT_CATEGORIES: Array<{ name: string; kind: "INCOME" | "EXPENSE"; icon: string }> = [
  { name: "Salary", kind: "INCOME", icon: "briefcase" },
  { name: "Freelancing", kind: "INCOME", icon: "laptop" },
  { name: "Business Income", kind: "INCOME", icon: "store" },
  { name: "Other Income", kind: "INCOME", icon: "plus-circle" },
  { name: "Food & Groceries", kind: "EXPENSE", icon: "shopping-basket" },
  { name: "Transport", kind: "EXPENSE", icon: "car" },
  { name: "Bills & Utilities", kind: "EXPENSE", icon: "receipt" },
  { name: "Rent", kind: "EXPENSE", icon: "home" },
  { name: "Shopping", kind: "EXPENSE", icon: "shopping-bag" },
  { name: "Education", kind: "EXPENSE", icon: "graduation-cap" },
  { name: "Health", kind: "EXPENSE", icon: "heart-pulse" },
  { name: "Travel", kind: "EXPENSE", icon: "plane" },
  { name: "Subscriptions", kind: "EXPENSE", icon: "tv" },
  { name: "Other", kind: "EXPENSE", icon: "tag" },
];

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
        categories: { create: DEFAULT_CATEGORIES },
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
