/**
 * RAQAMORA server auth — scrypt password hashing + HMAC-signed session tokens
 * stored in an httpOnly cookie. No secrets exposed to the browser.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_COOKIE = "raqamora_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.AUTH_SECRET || "raqamora-dev-secret-do-not-use-in-prod";
}

// ---------- password hashing ----------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---------- session tokens ----------
function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function createToken(userId: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })));
  const sig = b64url(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "string" || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

// ---------- cookie helpers ----------
export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const uid = verifyToken(token);
  if (!uid) return null;
  const user = await db.user.findUnique({
    where: { id: uid },
    select: {
      id: true, email: true, name: true, isDemo: true, onboarded: true,
      currency: true, warnThreshold: true,
    },
  });
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Throws 401 if not authenticated. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not authenticated. Please sign in again.");
  return user;
}

/** Standard JSON error responses for API routes. */
export function errorResponse(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  console.error("[raqamora:api]", err);
  return { status: 500, body: { error: "Something went wrong. Please try again." } };
}
