/** Shared view wiring for RAQAMORA views — imported by view agents and the app shell. */
import type { SessionUser } from "@/lib/raqamora/types";

export type ViewKey =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "people"
  | "debts"
  | "budgets"
  | "goals"
  | "recurring"
  | "reports"
  | "notifications"
  | "settings";

/** Every view component receives these props. */
export type ViewProps = {
  user: SessionUser;
  onViewChange: (v: ViewKey) => void;
};
