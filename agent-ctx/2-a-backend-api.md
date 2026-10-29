# Task 2-a — RAQAMORA Backend API Layer — Work Record

## Status: COMPLETE ✅ (tsc --noEmit clean for all files below; eslint clean)

## Files created (31 route files + 2 colocated helper modules)

Shared (colocated inside `src/app/api/_lib/`, no routes generated from them):
- `src/app/api/_lib/dates.ts` — Karachi (UTC+5) range math: `karachiShift`, `karachiDayKey`,
  `karachiWeekRange` (Monday-start), `karachiMonthRange`, `karachiYearRange`,
  `karachiMonthRangeFromKey`, `advanceKarachi` (DAILY +1d, WEEKLY +7d, MONTHLY/YEARLY calendar add
  with day-of-month clamp on the Karachi calendar), `karachiDate`, `karachiStamp`.
- `src/app/api/_lib/rows.ts` — `txnRels` (Prisma include for `mapTxn`), `mapRecurring` +
  `mapRecurringList` (resolves account/category names — RecurringRule has NO Prisma relations, only
  scalar FKs), `mapGoal` (currentAmount = Σ contributions, percent clamped to 100).

Routes:
- `transactions/route.ts` (GET filters/q/pagination/sort + POST with per-reference ownership checks)
- `transactions/[id]/route.ts` (PATCH amount/date/note/categoryId/personId only; DELETE — debt-linked
  LENT/BORROWED blocked, REPAYMENT_* deletable)
- `debts/route.ts` (GET direction/status filters; POST atomic Debt + LENT/BORROWED txn)
- `debts/repay/route.ts` (POST atomic: re-reads debt+repayments inside `db.$transaction`, rejects
  amount > outstanding with Rs-formatted message, settles at 0)
- `debts/[id]/route.ts` (GET debt+repayments, PATCH note/dueDate, DELETE only without repayments —
  removes linked LENT/BORROWED txn atomically)
- `accounts/route.ts`, `accounts/[id]/route.ts` (DELETE 400 "Move or delete its transactions first")
- `categories/route.ts` (txnCount via groupBy), `categories/[id]/route.ts` (DELETE 400 → archive)
- `people/route.ts` (outstanding aggregates + lastActivity), `people/[id]/route.ts` (detail+debts+txns)
- `budgets/route.ts` (month param, Karachi month usage), `budgets/[id]/route.ts`
- `goals/route.ts`, `goals/contribute/route.ts` (intention only — no txn), `goals/[id]/route.ts`
- `recurring/route.ts`, `recurring/run/route.ts` (idempotent: re-reads rule inside per-rule
  transaction, creates ONE txn per due rule, fast-forwards nextDate until > now, stamps lastRun,
  guards endDate), `recurring/[id]/route.ts`, `recurring/[id]/skip/route.ts`
- `dashboard/route.ts` (full DashboardData: Karachi today/week/month/year/custom ranges, period
  summary, receivables/payables/netPosition, current-month budgetUsage with threshold warnings,
  upcoming debts(30d)/recurring(7d), dailyFlow (≤62 pts, month-buckets for long custom ranges, []
  for year), expenseByCategory top8+Other, monthlyTrend last 6 months, recent 8, largestExpenses 5,
  frequentCategories 5, peopleWithBalances 6, previous-period comparison)
- `reports/route.ts` (summary, daily/weekly/monthly buckets on Karachi calendar, byCategory
  (INCOME + EXPENSE net of refunds), byAccount (inflow/outflow via accountDelta), repaymentHistory,
  largest 5, netPositionTrend = month-end Σbalances + receivables − payables approximated over txns
  up to month end)
- `export/transactions/route.ts` (CSV, quote-escaped, CRLF, attachment
  `raqamora-transactions-YYYYMMDD.csv`, same filters as list incl. account-filter via AND)
- `export/backup/route.ts` (full JSON backup, attachment)
- `notifications/route.ts` (list + unread), `notifications/generate/route.ts` (BUDGET_WARN/OVER,
  DEBT_OVERDUE, DEBT_DUE ≤7d, RECURRING_DUE ≤3d; dedup on unread (kind, refId)),
  `notifications/read-all/route.ts`, `notifications/[id]/route.ts` (PATCH read)
- `settings/route.ts` (PATCH name/warnThreshold → SessionUser), `settings/reset/route.ts`
  (FK-safe wipe in one $transaction, keeps login, isDemo=false)
- `demo/seed/route.ts` (atomic wipe+seed: Cash/HBL/Easypaisa; 14 categories; Ali/Hassan/Fatima;
  4 debts — Ali receivable 15,000 partially repaid 5,000 (outstanding 10,000), Hassan payable
  8,000 due in 5d, Fatima receivable 3,500 SETTLED, Ali payable 2,500 with 1,000 repaid and OVERDUE;
  ~62 txns over last ~84 days incl. salary on the 1st ×3 months, rent 5th ×3, LESCO/PTCL,
  Netflix/Spotify, 12 weekly groceries, 16 rides, one Cash→Easypaisa TRANSFER, one Shopping REFUND;
  budgets Food & Groceries 20k + Transport 8k; Umrah + Emergency goals with contributions; 2 MONTHLY
  recurring rules; deterministic PRNG; sets isDemo+onboarded)

## Contract ambiguities resolved (decisions taken)
1. **txnWhere OR-collision (shared lib bug avoided, not edited):** when both `q` and `accountId`
   filters are present, `txnWhere`'s `where.OR` would be overwritten. Routes pass all filters except
   `accountId` to `txnWhere` and attach the account condition via `where.AND`, preserving both.
2. **RecurringRule has no relations in schema** → include impossible. Added `mapRecurringList`
   helper that resolves account/category names from two small lookups.
3. **karachiNow() double-shift pitfall:** `karachiNow()` returns a *shifted* date and
   `karachiMonthKey()` shifts again internally — so current month key is computed as
   `karachiMonthKey(new Date())` (real instant), never `karachiMonthKey(karachiNow())`.
   Range helpers (`karachiDayRange`/week/month/year) take the shifted date, matching data.ts convention.
4. **Dashboard response shape:** returns the `DashboardData` object directly (no `{dashboard}` wrapper),
   per "→ DashboardData" in the contract; other list endpoints keep their `{key: []}` wrappers.
5. **Recurring run:** creates exactly ONE transaction per due rule per invocation (contract wording)
   for the oldest scheduled occurrence, then advances `nextDate` by frequency until > now; `date` of
   the created txn = the rule's scheduled `nextDate`; per-rule transaction re-read makes it idempotent.
6. **Debt status after repayment deletion:** DB status may stay SETTLED, but `getDebtsWithOutstanding`
   derives status from outstanding, so reads self-correct (contract rule 10 satisfied).
7. **DELETE /transactions/[id]:** forbidden only for LENT/BORROWED rows; REPAYMENT_* rows deletable
   (rule 10), PATCH still blocked for all debt-linked rows.
8. **totalBalance** = Σ balances of ALL accounts (incl. archived) for consistency with
   `computeNetPosition`, which also takes all balances.
9. **goal percent** clamped to 100; **budget percent** intentionally NOT clamped (drives BUDGET_OVER).
10. **settings/reset** sets `isDemo=false` (data is no longer demo) and keeps session/onboarded.
11. **CSV Amount (Rs)** always positive; ADJUSTMENT sign lives in "Direction/Reason" column
    (`DECREASE/INCREASE: reason`), debt types get "Lent to/Borrowed from/Received from/Paid to {person}".
12. **404 vs 400:** missing/foreign resources → 404; validation/business rules → 400 with actionable
    message (contract's 400s preserved verbatim where quoted).

## Verification
- `bunx tsc --noEmit -p tsconfig.json` → **0 errors in `src/app/api/**`** (only pre-existing errors
  in `examples/` and `skills/` remain, owned by other tasks).
- `bunx eslint src/app/api --no-ignore` → clean.
- Dev server untouched; schema untouched; auth/onboarding routes untouched; no test files.
