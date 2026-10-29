# RAQAMORA — Implementation Contract (subagent reference)

Read this file fully before writing code. Follow it exactly.

## Environment constraints (NON-NEGOTIABLE)
- Next.js 16 App Router, TypeScript strict. Only route: `src/app/page.tsx` (SPA with client-side views).
- Backend = API routes under `src/app/api/**`. NO server actions.
- DB = Prisma + SQLite. Import client: `import { db } from "@/lib/db"`.
- Money = **integer paisa** (1 PKR = 100 paisa). Never floats. Convert at the API edge:
  request `amountRupees` (number) → store `Math.round(amountRupees * 100)` as `amount` (paisa).
- Timezone Asia/Karachi (UTC+5, no DST). Month key = "YYYY-MM" of (date + 5h).
- DO NOT run `bun run dev`, `db:push`, or `bun run build`. DO NOT edit `prisma/schema.prisma`.
- DO NOT start background processes. Lint is run by the lead later.

## Core libs (already written — import, never re-implement)
- `@/lib/raqamora/money` — `parseRupeesToPaisa`, `formatRupees(paisa)`, `formatPKR(paisa, {compact?})`
- `@/lib/raqamora/finance` — `TXN_TYPES`, `TxnType`, `TXN_TYPE_LABELS`, `ACCOUNT_TYPES`,
  `ACCOUNT_TYPE_LABELS`, `accountDelta(type, amount, signed)`, `computeAccountBalance`,
  `computeDebtOutstanding`, `computePeriodSummary(txns)`, `computeNetPosition`, `txnFieldRequirements`
- `@/lib/raqamora/types` — `AccountWithBalance, DebtWithOutstanding, TxnRow, CategoryRow, PersonRow,
  BudgetRow, GoalRow, RecurringRow, NotificationRow, DashboardData, SessionUser, PeriodSummary`
- `@/lib/raqamora/validation` — zod schemas: signupSchema, loginSchema, onboardingSchema, accountSchema,
  categorySchema, personSchema, transactionSchema, debtSchema, repaymentSchema, budgetSchema,
  goalSchema, contributionSchema, recurringSchema, settingsSchema
- `@/lib/server/auth` — `hashPassword, verifyPassword, setSessionCookie, clearSessionCookie,
  getSessionUser, requireUser (throws HttpError), HttpError, errorResponse(err) → {status, body}`
- `@/lib/server/data` — `getAccountsWithBalances(userId), getDebtsWithOutstanding(userId),
  mapTxn(txn), txnWhere(userId, filters), karachiNow(), karachiDayRange(d), karachiMonthKey(d)`

## Financial invariants (MUST hold)
1. INCOME: +account, counts as income. EXPENSE: −account, counts as expense.
2. TRANSFER: −from, +to. NEVER income/expense.
3. LENT: −account, +receivable (NOT expense). BORROWED: +account, +payable (NOT income).
4. REPAYMENT_RECEIVED: +account, −receivable (NOT income). REPAYMENT_MADE: −account, −payable (NOT expense).
5. REFUND: +account, offsets expense (summary uses expense − refunds).
6. ADJUSTMENT: signed (−1/1 in `signed` field), requires `reason`.
7. Repayments cannot exceed outstanding debt (validate server-side inside a `db.$transaction`).
8. Every mutation: authenticate via `requireUser()`, validate via zod, scope all reads/writes by `userId`.
9. Debt creation with `recordNow: true` creates TWO records atomically: the Debt AND the first
   Transaction (LENT/BORROWED) linked via `debtId` + `personId`.
10. Deleting transactions linked to a debt (`debtId != null`) is forbidden → return 400
    "Linked debt records cannot be deleted; delete the debt instead" (REPAYMENT_* rows may be deleted,
    which restores debt outstanding automatically since outstanding is derived).

## API contract (all responses JSON; errors: `{ error: string }` with proper status)
Auth cookies are httpOnly; use `requireUser()` everywhere. Wrap handlers:
```ts
try { ... } catch (err) { const { status, body } = errorResponse(err); return NextResponse.json(body, { status }); }
```

### Auth (already implemented — do NOT touch)
- POST /api/auth/signup {name,email,password} → {user: SessionUser} (creates default categories, sets cookie)
- POST /api/auth/login {email,password} → {user}
- POST /api/auth/logout → {ok:true}
- GET /api/auth/me → {user|null}

### Onboarding
- POST /api/onboarding {name, accountName, accountType, openingBalanceRupees} → {user}
  (sets user.name, onboarded=true; creates first Account with opening balance)

### Accounts
- GET /api/accounts → {accounts: AccountWithBalance[]}
- POST /api/accounts (accountSchema) → {account}
- PATCH /api/accounts/[id] {name?, color?, icon?, archived?} → {account}
- DELETE /api/accounts/[id] → 400 if transactions exist ("Move or delete its transactions first"),
  else deletes → {ok:true}

### Categories
- GET /api/categories → {categories: CategoryRow[]} (txnCount per category)
- POST /api/categories (categorySchema) → {category}
- PATCH /api/categories/[id] {name?, icon?, archived?} → {category}
- DELETE /api/categories/[id] → if has transactions → 400 "Archive instead", else delete → {ok:true}

### People
- GET /api/people → {people: PersonRow[]} (receivableOutstanding/payableOutstanding from debts)
- POST /api/people (personSchema) → {person}
- GET /api/people/[id] → {person, debts: DebtWithOutstanding[], txns: TxnRow[]}
- PATCH /api/people/[id] (personSchema partial) → {person}
- DELETE /api/people/[id] → 400 if they have debts/transactions → {ok:true} otherwise

### Transactions
- GET /api/transactions?q&type&categoryId&accountId&personId&from&to&page&pageSize&sort(date_asc|date_desc|amount_desc|amount_asc)
  → {txns: TxnRow[], total, page, pageSize}
- POST /api/transactions (transactionSchema) → creates ONE transaction row with proper fields:
  - amount = Math.round(amountRupees*100)
  - EXPENSE may carry optional personId (paid for someone)
  - ADJUSTMENT: signed = adjustDirection === "DECREASE" ? -1 : 1, reason required
  → {txn: TxnRow}
- PATCH /api/transactions/[id] — only amount/date/note/categoryId/personId editable,
  NEVER type/account/debt-linked rows (400 otherwise) → {txn}
- DELETE /api/transactions/[id] → forbidden if debtId set (see rule 10) → {ok:true}

### Debts
- GET /api/debts?direction&status → {debts: DebtWithOutstanding[]}
- POST /api/debts (debtSchema) → atomic: create Debt (+optional LENT/BORROWED transaction) → {debt}
- POST /api/debts/repay (repaymentSchema) → ATOMIC: verify debt belongs to user, outstanding>0,
  amount ≤ outstanding; create REPAYMENT_RECEIVED (RECEIVABLE) or REPAYMENT_MADE (PAYABLE) txn
  with debtId+personId; if outstanding hits 0 → status SETTLED. → {debt: DebtWithOutstanding}
- GET /api/debts/[id] → {debt, repayments: TxnRow[]}
- PATCH /api/debts/[id] {note?, dueDate?} → {debt}
- DELETE /api/debts/[id] → only if no repayments (400 otherwise); also deletes linked LENT/BORROWED
  txn atomically → {ok:true}

### Budgets
- GET /api/budgets?month=YYYY-MM (default current Karachi month) → {budgets: BudgetRow[]}
  where used = sum EXPENSE txns of that category within month (Karachi boundaries)
- POST /api/budgets (budgetSchema) → upsert by (userId,categoryId,month) → {budget}
- PATCH /api/budgets/[id] {amountRupees} → {budget}
- DELETE /api/budgets/[id] → {ok:true}

### Savings goals
- GET /api/goals → {goals: GoalRow[]} (currentAmount = sum contributions, percent)
- POST /api/goals (goalSchema) → {goal}
- POST /api/goals/contribute {goalId, amountRupees, date, note} → {goal} (creates Contribution;
  money does NOT leave accounts — it is a tracked intention, NOT a transaction)
- PATCH /api/goals/[id] {name?, targetAmountRupees?, targetDate?, note?} → {goal}
- DELETE /api/goals/[id] → {ok:true}

### Recurring
- GET /api/recurring → {recurring: RecurringRow[]}
- POST /api/recurring (recurringSchema) → {recurring}
- POST /api/recurring/run → for each active rule with nextDate ≤ now (Karachi) and not past endDate:
  create the transaction (idempotent via lastRun + nextDate check inside a transaction), advance
  nextDate by frequency until > now, set lastRun. → {created: number}
- POST /api/recurring/[id]/skip → advance nextDate by one frequency → {recurring}
- PATCH /api/recurring/[id] {active?, note?, amountRupees?, nextDate?} → {recurring}
- DELETE /api/recurring/[id] → {ok:true}

### Dashboard
- GET /api/dashboard?range=today|week|month|year|custom&from&to
  → DashboardData (see types.ts). Notes:
  - period from/to = Karachi boundaries (range custom requires from&to ISO strings)
  - summary = computePeriodSummary over txns in period
  - receivables/payables = sum outstanding from getDebtsWithOutstanding
  - budgetUsage: current Karachi month budgets with used/percent; warnings = percent ≥ user.warnThreshold
  - upcoming: debts with dueDate in next 30 days or overdue (overdue flag), recurring rules with
    nextDate ≤ now+7d (kind: "DEBT" | "RECURRING"), sorted by date
  - charts: dailyFlow (income/expense per day in range, ≤ 62 points; for year range use monthlyTrend),
    expenseByCategory (netExpense by category in range, top 8 + "Other"), monthlyTrend (last 6
    months income/expense)
  - recent: latest 8 txns; largestExpenses: top 5 EXPENSE in range; frequentCategories: top 5 by count
    in range; peopleWithBalances: top 6 people with receivable/payable outstanding > 0
  - comparison: same length previous period {income, expense}

### Reports
- GET /api/reports?from&to (ISO) → {
    summary: PeriodSummary, daily: [{date, income, expense}], weekly: [{week, income, expense}],
    monthly: [{month, income, expense}], byCategory: [{name, kind, total, count}],
    byAccount: [{name, inflow, outflow}], repaymentHistory: TxnRow[], largest: TxnRow[],
    netPositionTrend: [{month, netPosition}]
  } (netPositionTrend: month-end account balances + outstanding receivables − payables approximated
  with balances computed over txns up to month end)

### Export
- GET /api/export/transactions?...same filters as list → text/csv attachment
  columns: Date (ISO), Type, Amount (Rs), Account, To Account, Category, Person, Note, Direction/Reason
  Must respect filters + auth. Filename `raqamora-transactions-YYYYMMDD.csv`.
- GET /api/export/backup → JSON of all user data (full backup)

### Notifications
- GET /api/notifications → {notifications: NotificationRow[], unread: number}
- POST /api/notifications/generate → recomputes: budget warnings (≥ threshold), overdue debts,
  debts due ≤7d, recurring due ≤3d. Creates Notification rows only if an unread one with same
  (kind, refId) does not already exist. → {created: number}
- POST /api/notifications/read-all → {ok:true}
- PATCH /api/notifications/[id] {read:true} → {notification}

### Settings
- PATCH /api/settings (settingsSchema) → {user}
- POST /api/settings/reset → deletes ALL user financial data (accounts, categories, people, txns,
  debts, budgets, goals, recurring, notifications, contributions) — keeps login → {ok:true}
  (frontend must confirm with typed confirmation)
- POST /api/demo/seed → wipes user's financial data, seeds realistic Pakistan-themed demo data
  (accounts: Cash, HBL Bank, Easypaisa; categories; people Ali/Hassan/Fatima with mixed debts
  incl. partial repayment scenarios; ~3 months of txns; budgets; goals; recurring rules),
  sets user.isDemo=true → {ok:true}

## Shared conventions
- Route files: `export async function GET/POST/PATCH/DELETE(req: NextRequest, ctx: { params: Promise<{id: string}> })`
  — in Next 16 params is a Promise: `const { id } = await ctx.params;`
- Never trust client IDs: always filter by `userId` first.
- All list endpoints sort sensibly and cap page size (≤ 200).
- Dates: accept ISO strings; store via `new Date(iso)`.
- Add `import { NextResponse } from "next/server"` as needed. Type everything, no `any`.
