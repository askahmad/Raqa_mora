# RAQAMORA — Your Money. One Clear Picture.

A premium, Pakistan-first **personal finance command center**: track income, expenses,
transfers, person-wise lends & borrowings, budgets, savings goals and recurring bills —
with exact paisa-level arithmetic and honest financial semantics.

> Built with Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · shadcn/ui ·
> Prisma + SQLite · Recharts · React Hook Form + Zod.

---

## What was implemented

**Financial core (correctness-first)**
- 9 transaction types: Income, Expense, Transfer, Money Lent, Money Borrowed,
  Repayment Received, Repayment Made, Refund, Balance Adjustment (audited, reason required).
- All money stored as **integer paisa** — no binary floating point anywhere in the ledger.
- Transfers never count as income/expense; lending/borrowing never distort spend;
  repayments never inflate income. Net position = **cash + receivables − payables**.
- Debt repayments are validated atomically (`db.$transaction`) and can never exceed
  the outstanding amount; debts auto-settle at zero.
- Balances are **derived** (opening balance + transaction effects), so history stays auditable.

**Screens (SPA over a single `/` route)**
- Landing + one-click **live demo** (`Explore live demo — sample data`)
- Auth (sign up / sign in / sign out) + 3-step onboarding (name → first account → done)
- **Dashboard**: period selector (Today/Week/Month/Year/Custom), comparison vs previous
  period, receivables/payables band, income-vs-expense chart, category donut, 6-month
  trend, budget health, upcoming & overdue, recent transactions, largest expenses,
  frequent categories, first-run guidance
- **Transactions**: search, 6 filters, sort, server-side pagination, details/edit/delete,
  CSV export that respects active filters
- **Accounts**: cash/bank/Easypaisa/JazzCash/savings/custom, balances, per-account
  history, transfers, archive, **balance reconciliation** (creates audited adjustments)
- **People (digital khata)** + per-person detail: position cards, ledger entries with
  repayment progress, repayment history, full activity timeline, CSV/printable statement
- **Debts**: receivables/payables/settled tabs, overdue & due-soon insight strip,
  record repayment with outstanding cap, edit note/due date
- **Budgets**: monthly category limits, progress with amber warning ≥ threshold and
  red overspend state, month navigation
- **Savings goals**: targets, contributions (tracked intentions — money stays in accounts),
  contribution history
- **Recurring**: daily/weekly/monthly/yearly rules, idempotent "Process due now",
  skip-next, pause/resume (nothing is charged automatically — honest by design)
- **Notifications**: budget warnings, overdue debts, due-soon payments, recurring reminders
  (deduplicated), mark-read, deep links
- **Reports**: custom date ranges + presets, daily/monthly flows, savings & net-position
  trends, category comparison with share bars, account-wise movement, repayment history,
  largest transactions, **CSV export** + print-to-PDF stylesheet
- **Settings**: profile & budget threshold, JSON backup download, demo data loader,
  typed-confirmation data wipe, about/privacy

**Demo mode** is explicit: seeded data replaces (after confirmation) and is badged `DEMO`
in the shell; it is never presented as real persistent data.

## Deviations from the original spec (environment constraints)

| Spec asked for | Implemented instead | Why |
| --- | --- | --- |
| Supabase PostgreSQL + RLS | Prisma + SQLite, **every query scoped by `userId` server-side** | Sandbox provides Prisma/SQLite; ownership enforced in every API route (verified: cross-user reads/writes/deletes are rejected) |
| Supabase Auth | httpOnly-cookie sessions: scrypt password hashing + HMAC-signed tokens (no secrets in browser) | Same security posture, zero external dependency |
| Supabase Storage for receipts | Not implemented (attachments omitted) | No object storage in sandbox; documented as a next step |
| Multi-route pages (`/dashboard`, `/transactions`, …) | Single `/` route with client-side view switching | Sandbox preview exposes only `/`; all 12 screens exist as views |
| Vitest/Playwright suites | Financial invariants verified **end-to-end in a real browser** (scenarios A–H below) | Per build environment: no test runner; correctness proven interactively |

## Getting started

```bash
bun install
bun run db:push      # create SQLite database from prisma/schema.prisma
bun run dev          # http://localhost:3000 (dev server logs → dev.log)
bun run lint         # ESLint
bunx tsc --noEmit    # type-check
```

Environment variables (`.env`): `DATABASE_URL="file:./db/custom.db"` (already configured).
Optional: `AUTH_SECRET` — HMAC secret for session tokens (a dev fallback exists; set a
strong value in production).

First run: create an account → onboarding creates your first account → or click
**Explore live demo** for instant sample data.

## Verified in-browser (agent-browser, real clicks — all passed)

- **A**: Opening balance Rs 20,000 → expense Rs 2,000 → balance Rs 18,000 (income Rs 0)
- **B**: Lend Rs 10,000 to Ali → cash −10,000, receivable +10,000, expenses unchanged
- **C**: Ali repays Rs 4,000 → cash +4,000, outstanding Rs 6,000, income unchanged
- **D**: Transfer Rs 3,000 Cash → Easypaisa → both accounts move, income/expense unchanged
- **E**: Borrow Rs 8,000, repay Rs 3,000 → payable Rs 5,000
- **F**: Repayment of Rs 99,999 vs Rs 5,000 outstanding → **rejected** ("Cannot exceed
  outstanding"), no balance change (client + server validation)
- **G**: Second user attempting to read/edit/delete first user's records via API →
  ownership-scoped 404/400 rejections, first user's data intact
- **H**: CSV export honours date filters, proper escaping, unambiguous types/directions
- Demo seeding, budgets (40 % usage → amber logic), notifications (warning/overdue/due-soon),
  reports, mobile layout (bottom nav + FAB), zero console errors

## Known limitations / next steps

- Receipt attachments need an object store (design ready: `Transaction.note`/schema slot)
- Recurring rules run via the **Process due now** button (no cron in sandbox); a scheduler
  (cron job hitting `POST /api/recurring/run`) is the documented production path
- Urdu/Roman-Urdu labels and natural-language quick entry ("Ali ko 5000 diye") are roadmap
  items; the language-preference groundwork (`locale`) is in place
- Single-workspace model (no shared households yet)
