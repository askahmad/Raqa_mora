# Task 3-b — RAQAMORA Transactions + Accounts views & TransactionQuickAdd — Work Record

## Status: COMPLETE ✅ — `bunx tsc --noEmit` clean for all 3 files, `bun run lint` clean (whole repo lints with 0 errors/warnings)

## Files written (only my 3 view files + this record)

1. `src/components/raqamora/views/transaction-quick-add.tsx` — flagship type-driven quick-add form (default export kept; signature `({ onSaved, defaultType?: TxnType })`, compatible with app-root shell usage).
2. `src/components/raqamora/views/transactions.tsx` — full Transactions view (default export, `ViewProps` signature).
3. `src/components/raqamora/views/accounts.tsx` — full Accounts view (default export, `ViewProps` signature).

Exports from quick-add reused by the other two files (kept within my file scope):
`useUnauthorizedGuard` (stable 401 guard via latest-ref pattern — the app-root context identity changes
every AppRoot render, e.g. the 60s unread poll, so context values are never put in effect deps),
`Field` (label + hint + inline error shell), `toLocalInputValue`, `karachiDateTimeIso`.

## TransactionQuickAdd — behavioral matrix (type → network calls on Save)

| Type | Fields shown | Call(s) on save |
|---|---|---|
| INCOME | Amount, Date, Category (kind=INCOME), Account, Note | `POST /api/transactions {type, amountRupees, date(ISO), note, accountId, categoryId}` |
| EXPENSE | Amount, Date, Category (kind=EXPENSE), Account, Note | same with EXPENSE |
| TRANSFER | Amount, Date, From + To account (distinct enforced by zod superRefine + disabled mirror item; live balance hints under each), Note | `POST /api/transactions {type, accountId, toAccountId, …}` |
| LENT | Person (+ inline add-person Popover → `POST /api/people`), Account, ledger checkbox (default ON) + optional Due date | checkbox ON → **single** `POST /api/debts {personId, direction:RECEIVABLE, principalRupees, note, accountId, dueDate, recordNow:true}` (atomic Debt + LENT txn; `/api/transactions` skipped per contract rule 9); checkbox OFF → `POST /api/transactions {type:LENT, accountId, personId}` |
| BORROWED | same as LENT | same with `direction:PAYABLE` → BORROWED txn |
| REPAYMENT_RECEIVED | Person, Debt select (fetched `GET /api/debts?direction=RECEIVABLE&status=ACTIVE`, filtered client-side by personId; label `Rs principal · outstanding Rs X`; selects auto-fill amount = outstanding; "Max" button), Account, Note | `POST /api/transactions {type, accountId, personId, debtId, …}`; client-side cap: amount > outstanding → inline error `Cannot exceed outstanding Rs X` (and debtId required error if none) |
| REPAYMENT_MADE | same | same, `direction=PAYABLE` fetch |
| REFUND | Amount, Date, Category (kind=EXPENSE per contract), Account, Note | `POST /api/transactions {type:REFUND, categoryId, …}` |
| ADJUSTMENT | Direction toggle (Increase/Decrease → `adjustDirection`), Reason (required), Account, Amount, Date | `POST /api/transactions {type:ADJUSTMENT, adjustDirection, reason, accountId, …}` |

Details: 3×3 type grid (radio semantics, emerald ring when selected, icons per type); amount input with
"Rs" adornment, step 0.01, min 0.01, autofocus, Enter submits; datetime-local defaults to now and is
interpreted as **Asia/Karachi wall time** (`+05:00` appended) before ISO conversion, consistent with
list-filter boundaries; accounts/categories/people fetched once on open via `Promise.all`; archived
accounts/categories filtered out; base-data load has skeleton + retry EmptyState + "no accounts" state;
success → sonner toast with type label + `formatPKR` amount → `onSaved()` (shell closes dialog +
dispatches `raqamora:txn-changed`); 401 → `handleUnauthorized()`; other errors → toast with server message.

## Transactions view

- PageHeader + **Export CSV** (anchor-click download of `/api/export/transactions` with the exact current
  filter query; date-only inputs expanded to full Karachi-day ISO bounds `T00:00:00+05:00` / `T23:59:59+05:00`)
  and **Add transaction** (emerald → local Dialog hosting TransactionQuickAdd; onSaved closes + dispatches `raqamora:txn-changed`).
- Filter card: debounced (300 ms) search `q`, Type select (all TXN_TYPE_LABELS), Category select (grouped Expense/Income),
  Account select (archived marked), Person select, From/To date inputs, Sort select (date_desc/date_asc/amount_desc/amount_asc),
  Clear filters; every filter change resets to page 1.
- List: `GET /api/transactions` page/pageSize 25 with `qs()`. Desktop: shadcn Table (Date+Karachi time, TypeBadge,
  description cell = category AppIcon tile + note/category title + person chip, Account column shows `A → B` for
  transfers, right-aligned `.money` amount: +emerald for INCOME/REFUND/REPAYMENT_RECEIVED/BORROWED, −red for
  EXPENSE/LENT/REPAYMENT_MADE, muted `−Rs x` for TRANSFER, ± by `signed` for ADJUSTMENT). Rows are keyboard-tappable
  (tabIndex + Enter/Space). Mobile (<md): stacked tappable card rows.
- Details dialog: full fields incl. reason, debt-link notice with **Open Debts** (`onViewChange("debts")`); Edit hidden
  for debt-linked rows (PATCH blocks them); Delete via ConfirmDialog — 400 "Linked debt records cannot be deleted…"
  → toast error + tip to delete the debt from the Debts page.
- Edit dialog (RHF + local zod schema): only amount/date/note + category (if present or INCOME/EXPENSE/REFUND) +
  person (if present or EXPENSE) editable and sent; type/account(s) shown as locked text — matches the PATCH contract
  exactly (forbidden keys never included).
- Pagination Previous/Next + `Showing X–Y of Z` (aria-live); auto page-clamp when the dataset shrinks.
- Empty states: zero txns → "Start with your first transaction" + add action; filter miss → "Try different filters" +
  clear action; load error → retry. List listens for `raqamora:txn-changed` → refetch (filters preserved).

## Accounts view

- PageHeader + **Transfer** (outline → local Dialog with `<TransactionQuickAdd defaultType="TRANSFER">`) + **New account** (emerald).
- Navy summary strip: total across active accounts (Money xl), "Across N active accounts · M archived".
- Card grid (2/3 cols): color-tinted AccountIcon tile, name, type label, Money lg (red when negative), txn count,
  archived badge; DropdownMenu: View history / Edit / Adjust balance / Archive–Unarchive / Delete (destructive).
- Archived section: collapsed by default (chevron toggle), muted cards, unarchive via menu.
- New/Edit dialog (RHF + zodResolver(accountSchema)): name, type select (disabled in edit — API PATCH has no `type`),
  opening balance (create only; edit explains corrections via Adjust balance), 8 preset color dots (emerald/gold/amber/
  danger/navy/stone — no blue/indigo), icon Select over ICON_CHOICES. Edit sends `{name, color, icon}` only.
- History dialog: `GET /api/transactions?accountId=<id>&sort=date_desc&pageSize=50`, scrollable list (thin scrollbar),
  header shows live balance Money; per-row type/date/person/to-account + signed amount.
- Adjust balance (reconciliation): recorded balance shown, actual-balance input parsed with `parseRupeesToPaisa`;
  diff preview (+emerald/−red); diff ≠ 0 → `POST /api/transactions {type:"ADJUSTMENT", amountRupees:|diff|/100,
  adjustDirection: INCREASE|DECREASE, accountId, reason:"Reconciliation on <Karachi date> — recorded Rs A, actual Rs B"}`,
  toast, dispatch `txn-changed` (accounts + transactions refetch). diff = 0 → "Balances already match", submit disabled.
- Delete: ConfirmDialog; 400 "Move or delete its transactions first" → toast + guidance to archive/move instead.
- All mutations toast + dispatch `raqamora:txn-changed`; view refetches on that event and on internal reload token.

## Contract notes / API mismatches observed

1. `PATCH /api/accounts/[id]` accepts only `name/color/icon/archived` — the task asked for a type select in the
   Edit dialog too; implemented disabled-in-edit to honor the API. No other mismatches.
2. `POST /api/transactions` does **not** enforce repayment ≤ outstanding (that validation lives in the atomic
   `POST /api/debts/repay`); quick-add therefore enforces the cap client-side (inline error), as instructed.
3. Backend `GET /api/transactions` applies `from/to` via `new Date(value)`; the view expands date-only inputs to
   Karachi day bounds so "to" is inclusive (matching user intent for a PKR app).
4. REPAYMENT rows are deletable per backend; LENT/BORROWED (debt-linked) are not — delete UI reflects both paths.

## Verification (exact commands)

- `cd /home/z/my-project && bunx tsc --noEmit 2>&1 | grep -E "views/(transactions|accounts|transaction-quick-add)"` → **empty**
- `cd /home/z/my-project && bun run lint 2>&1 | grep -E "views/(transactions|accounts|transaction-quick-add)"` → **empty**
- Full-repo tsc shows only the pre-existing `examples/` + `skills/` errors (owned by other tasks).
- Dev server / db:push / build NOT run, per contract.

## ⚠ Cross-file blocker for the lead (NOT touched — outside my 3-file scope)

`dev.log` shows `GET / 500` caused by **`src/components/raqamora/app-root.tsx`** (pre-existing since before my
changes — no `GET / 200` exists in the log): Next 16 requires the `next/dynamic` options argument to be an inline
object literal; app-root passes the shared `dynamicViewOptions` const → `next/dynamic options must be an object
literal` on every `VIEW_COMPONENTS` entry + `TransactionQuickAdd`. Fix in app-root.tsx: inline the options at each
call site, e.g. `nextDynamic(() => import("…"), { ssr: false, loading: () => <ViewLoading /> })` (drop the
`as const` shared const). My three modules type-check and lint clean; a runtime smoke test is blocked only by this.
