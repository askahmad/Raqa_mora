/** One-click demo entry: signup with throwaway credentials, then seed sample data. */
import { apiSend } from "@/lib/raqamora/client";
import type { SessionUser } from "@/lib/raqamora/types";

export const DEMO_EMAIL_BASE = "demo";
export const DEMO_PASSWORD = "raqamora-demo";

export async function startDemoSession(): Promise<SessionUser> {
  const email = `${DEMO_EMAIL_BASE}+${Date.now()}@raqamora.pk`;
  const { user } = await apiSend<{ user: SessionUser }>("/api/auth/signup", "POST", {
    name: "Demo User",
    email,
    password: DEMO_PASSWORD,
  });
  await apiSend("/api/demo/seed", "POST");
  // Demo accounts come pre-seeded, so skip onboarding.
  return { ...user, onboarded: true, isDemo: true };
}
