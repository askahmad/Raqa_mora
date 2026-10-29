# Task 3-a — RAQAMORA Dashboard & Reports Views — Work Record

## Status: COMPLETE ✅ (`bunx tsc --noEmit` → 0 errors in both files; `bun run lint` → clean for both files)

## Files written (only the two authorized files)
1. `src/components/raqamora/views/dashboard.tsx` — full DashboardView (default export, `ViewProps` signature kept).
2. `src/components/raqamora/views/reports.tsx` — full ReportsView (default export, `ViewProps` signature kept).

No other files created or modified.

## Dashboard view — what was built
- **Period selector**: segmented Today / This week / This month / This year (aria-pressed buttons) + separate **Custom** button opening a Popover with two `type="date"` inputs (From/To, min/max linked) and an Apply button. Custom sends `from=YYYY-MM-DDT00:00:00+05:00`, `to=...T23:59:59.999+05:00`. Refetch on change; period line under the selector shows `period.label` (or the real date span for custom, aria-live polite).
- **Metric row** (4 StatCards, `grid-cols-2 md:grid-cols-4`, staggered framer-motion entrance disabled under `prefers-reduced-motion`): Available balance (sub: "Across N accounts"), Income (trend badge vs `comparison.income`), Net expenses (trend vs `comparison.expense`, **inverted** coloring — increase is red; sub shows refunds when > 0), Net position (sub: "Cash + receivables − payables"). `pctChange` helper: prev=0 & cur>0 → "new" badge.
- **Money owed band**: two cards — To receive (emerald) / To pay (red) — each with a "Debts →" button (`onViewChange("debts")`) and up to 2 people from `peopleWithBalances` filtered by receivable/payable > 0.
- **Charts** (2-col on lg, 1-col mobile, ResponsiveContainer 210–230px):
  - Income vs Expenses — **BarChart** on `dailyFlow` (income `var(--chart-1)`, expense `var(--chart-5)`, maxBarSize 16, radius 3). For `range=year` (API returns `dailyFlow: []`) it falls back to `monthlyTrend` and relabels "Monthly totals". Tick formatter handles both day keys (`YYYY-MM-DD` → "5 Jan") and month keys (`YYYY-MM` → "Jan 25") since long custom ranges return monthly buckets.
  - Expense by Category — **donut PieChart** (`innerRadius 62%`, `paddingAngle 2`, `stroke var(--card)`) with absolute-centered "Net spend" total, brand-consistent 10-color palette, and a scrollable legend list (dot + AppIcon + name + % + Money).
  - 6-Month Trend — **LineChart** income vs expense (monotone, 2px, small dots).
  - Budget Health — overall **Progress** bar (indicator recolored per tone via `[&>[data-slot=progress-indicator]]:bg-*`: emerald / amber at `user.warnThreshold` / red > 100) + up to 3 warning rows (AppIcon + name + % + mini bar) + "+N more" note; empty → EmptyState → budgets view.
- **Upcoming & overdue**: SectionCard list (max-h-64 scroll) — HandCoins/Repeat kind icon (red tint when overdue), title, Karachi-formatted date, red "Overdue" Badge, Money, click → `debts` / `recurring`. Cap 6 + "+N more due soon" row. Empty: "Nothing due in the next 7 days".
- **Recent transactions**: 8 rows (TypeBadge, icon tile — AppIcon by category / User for person / ArrowLeftRight for transfer, account · date sub-line, Money colored by `accountDelta` sign; TRANSFER neutral showing "A → B"), "View all" → transactions.
- **Highlights**: two SectionCards — Largest Expenses (top 5, red amounts) and Frequently Used Categories (top 5 by count, neutral totals).
- **First-run hero** (accounts=0 && recent=0): 3-step explainer (add account → record transaction → demo) with "Add your first account" button and kit `DemoButton` (onDemo → `setUser(user)`, which refetches via the `user.id` effect dep).

## Reports view — what was built
- **Filters**: From/To `<Input type="date">` (min/max linked) + presets This month / Last month / Last 90 days / This year (active preset highlighted via `aria-pressed`, default = this month on the Karachi calendar via UTC+5 day math). Invalid range (to < from) suppresses fetch + amber hint. All data refilters through the single `GET /api/reports?from&to` call.
- **Header**: PageHeader + **Export CSV** (`window.location.href = /api/export/transactions?from&to`, same encoded range) and **Print / Save as PDF** (`window.print()`). Print mode: inline `@media print` CSS hides sidebar/topbar/nav/footer chrome, kills shadows, adds a print-only report title block; filter row and action buttons use Tailwind `print:hidden`.
- **Summary band**: 8 StatCards (`grid-cols-2 sm:grid-cols-3 xl:grid-cols-4`) — Income, Net expenses (sub: refunds), Net savings, Lent, Borrowed, Repayments received/made, Transfers.
- **Charts** (2-col lg): Daily Flow BarChart (auto-switches to monthly buckets when `daily.length > 92`, title adapts), Monthly Income vs Expenses BarChart, Net Position Trend **AreaChart** (gradient fill `url(#rq-np-fill)`), Savings Trend BarChart with per-Cell coloring (emerald ≥ 0, red < 0).
- **Tables** (shadcn Table, `min-w` + internal overflow-x-auto for mobile): Category Comparison (icon, TypeBadge kind, Count & Total sortable via header buttons sorted desc, share-of-total progress bars colored by kind), Account-wise Movement (Inflow emerald / Outflow red / Net colored), Largest Expenses (top 5), Repayment History (TypeBadge + person + date + signed Money, scrollable list, "People" action → `onViewChange("people")`).

## Shared patterns (both files)
- Fetch via `apiGet` only; 401 → `useApp().handleUnauthorized()` (captured in a ref to keep `load` deps stable — the context value is recreated each AppRoot render, so depending on it directly would refetch on every render).
- Refetch on `window` event `raqamora:txn-changed` (background refresh; keeps old data, toasts errors via `sonner` once data exists).
- Loading → kit SkeletonList + composed skeletons; error → EmptyState with retry; empty → actionable/quiet EmptyStates.
- Money always paisa via `<Money>` / `formatPKR({compact})` for axes; custom PKR tooltip component typed with recharts `TooltipProps<number, string>`.
- Karachi TZ formatting via `Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi" })`; month keys parsed at `YYYY-MM-15T12:00Z` (UTC-safe, no client-TZ drift).
- Hairline/compact styling, brand tokens only (no indigo/blue), tabular numerals, custom thin scrollbars on long lists.

## ⚠️ Blocking issue found OUTSIDE my scope — needs the owner's fix (NOT fixed by me)
`src/components/raqamora/app-root.tsx` breaks the Next 16 dev server: **`GET / → 500`, "next/dynamic options must be an object literal"**. The shared const
```ts
const dynamicViewOptions = { ssr: false, loading: () => <ViewLoading /> } as const;
```
is passed to 13 `nextDynamic()` calls. Next 16 Turbopack requires the options argument to be an inline object literal at each call site. tsc passes (it's a runtime/bundler constraint, not a type error), so per my instructions ("tiny edits ONLY for blocking type errors") I did not touch it. Suggested one-pattern fix for the owner: inline `{ ssr: false, loading: () => <ViewLoading /> }` in every `nextDynamic(...)` call in `app-root.tsx` and delete the const. Until then the app 500s on `/` even though both views compile clean.

## API notes (expected vs actual — no mismatches requiring backend changes)
- `GET /api/dashboard` returns the `DashboardData` object directly (no `{dashboard}` wrapper) — matched types.ts.
- `charts.dailyFlow` is `[]` for `range=year` (contract notes this) → implemented monthlyTrend fallback.
- `dailyFlow` entries use `date` as **day or month key** for custom ranges > 62 days — handled by the tick formatter.
- Reports `byCategory`/`byAccount` carry no icon field (`{name, kind, total, count}` / `{name, inflow, outflow}`) — icons are derived (kind-based AppIcon) instead of expecting them.
- `comparison` is always an object `{income, expense}` in the current backend (type allows null) — null-safe either way.
- Reports `weekly` is returned but unused by design (task scope didn't request a weekly chart).

## Verification
- `bunx tsc --noEmit 2>&1 | grep -E "views/(dashboard|reports)"` → **empty**
- `bun run lint 2>&1 | grep -E "views/(dashboard|reports)"` → **empty**
- Did not run dev server / build / db:push; no test files; no files outside the two views touched.
