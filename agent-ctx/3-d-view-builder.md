# Task 3-d — Work Record: Five RAQAMORA Views (Budgets, Goals, Recurring, Notifications, Settings)

## Agent
Task ID `3-d` — view-builder agent. All work in `/home/z/my-project/src/components/raqamora/views/`.

## Files written (only these 5 touched)
| File | Summary |
|---|---|
| `budgets.tsx` | Karachi-month navigation (‹ month ›, `Date.now()+5h` UTC parts, key `YYYY-MM`, "March 2025" label), overall card (limit vs used, threshold-aware bar: emerald/amber≥warnThreshold/red>100, remaining Money, overspent banner "Overspent by Rs X"), Set/Edit budget dialog (POST upsert `{categoryId, amountRupees, month}` / PATCH `{amountRupees}`), rows sorted percent desc with AppIcon, percent badge, "No spending yet" when used=0, edit+delete (ConfirmDialog), Food & Groceries preselect on empty state, note "Budget warnings are reminders, not transactions." Listens `raqamora:txn-changed`. |
| `goals.tsx` | Goal cards (name, note, progress bar capped 100, saved/target Money, target-date chip: emerald "On track/Completed", red "Overdue · was {date}", amber "Target {date}" behind pace; pace = elapsed/window using earliest contribution), remaining "X to go", Add contribution dialog (`POST /api/goals/contribute` with helper "Contributions track your intention — money stays in your accounts", success flash ring on card), Edit dialog (PATCH name/targetAmountRupees/targetDate-null-able/note), Delete confirm mentions contribution history loss, expandable History list (date/amount/note). Empty: "Saving for Hajj, a bike, or an emergency fund?…". |
| `recurring.tsx` | Header actions "New rule" + "Process due now" (`POST /api/recurring/run` → toast "Created N transaction(s)", dispatch `raqamora:txn-changed`, refetch; due count badge on button). Info banner: rules create transactions only when processed — not automatic, not on app load. Rule cards: TypeBadge (INCOME emerald/EXPENSE red/TRANSFER neutral), colored amount, frequency chip, next-date chip (red "Due now", amber ≤3 days, gray paused), category/account line (from → to for transfers), active Switch (PATCH `{active}`), Skip next (`POST /api/recurring/<id>/skip`), Edit, Delete. Create dialog = full `recurringSchema` (title/type/amount/frequency/nextDate/endDate/note/account/toAccount/category, always-on disabled checkbox "If already overdue, generate past occurrences on save"). Listens `raqamora:txn-changed`. |
| `notifications.tsx` | On mount: `POST /api/notifications/generate` once per session (module-level flag) then GET list + refreshUnread. "Check now" (toast created count + refetch + refreshUnread), "Mark all read" (optimistic + read-all + refreshUnread). Tabs All/Unread with counts; rows: kind icon tile (BUDGET_WARN/OVER, WARN amber Target; BUDGET_OVER, DEBT_OVERDUE red; DEBT_DUE amber HandCoins; RECURRING_DUE navy Repeat; GOAL_DONE emerald PiggyBank; INFO navy Info), title/message/relative time (formatDistanceToNow), emerald unread dot + tinted row; click row → PATCH read (optimistic) + refreshUnread; deep-link buttons "View debts/budgets/recurring" → setView. Empty per tab: "You're all caught up." |
| `settings.tsx` | Single column `max-w-2xl`. Profile: name + warn-threshold Slider 10–100 step 5 ("Budget warning threshold: N%") → PATCH `/api/settings` → setUser + toast. Data & backup: Download backup (Blob + a.click, `raqamora-backup-YYYYMMDD.json`), Load demo data (ConfirmDialog warns REPLACES → POST `/api/demo/seed` → GET `/api/auth/me` → setUser (DEMO badge), refreshUnread, dispatch txn-changed). Danger zone: Erase all requires typing `DELETE` → POST `/api/settings/reset` → toast + dispatch + refreshUnread + local isDemo:false. About: wordmark, tagline, v1.0, PKR (Rs), Asia/Karachi, integer-paisa note, privacy line. Session: Sign out → POST `/api/auth/logout` → `location.reload()`. Roadmap note re Urdu labels. |

## Shared conventions applied
- Default exports, `ViewProps` signature; `useApp()` for user/setUser/setView/refreshUnread/handleUnauthorized; every catch checks `ApiError.status === 401` → `handleUnauthorized()`.
- Money: display via `<Money>`/`formatPKR` (paisa); requests send `amountRupees` computed as `parseRupeesToPaisa(input)/100`.
- `SkeletonList` loading, error+Retry rows, `EmptyState`, `ConfirmDialog` for all destructive actions, sonner toasts, hairline borders, p-4/p-6, emerald/red/amber/gold palette only (no indigo/blue), mobile-first responsive, aria labels on icon buttons.

## API mismatches encountered (expected vs contract)
1. **Recurring PATCH is partial** (contract + implementation agree: only `active?/note?/amountRupees?/nextDate?`). The task asked for a full "Create/Edit dialog (recurringSchema)" — impossible for edit; the Edit dialog therefore edits exactly the PATCH-able fields (amount, next date, note) and states so in its description. Full schema is used for create.
2. **"Run once now" per rule** is not in the contract (run is bulk); per the task note, "Skip next" is provided instead.
3. **`POST /api/demo/seed` returns `{ok:true}` only** — to satisfy "setUser" after seeding, the view re-fetches `GET /api/auth/me` for the updated `isDemo` user.
4. **`POST /api/settings/reset` returns `{ok:true}` and clears `isDemo`** server-side; the DEMO badge is cleared via `setUser({...user, isDemo:false})` locally (no user in response).
5. Minor: notification auto-generate runs once per session via module-level flag exactly as specified.

## Verification results
- `bunx tsc --noEmit | grep views/(budgets|goals|recurring|notifications|settings)` → **empty** (only pre-existing errors in `examples/` and `skills/`, unrelated to src).
- `bun run lint | grep views/(budgets|goals|recurring|notifications|settings)` → **empty**; direct `bunx eslint` on the 5 files → exit 0.
- Did not run dev server, build, or db:push. No other files touched.
