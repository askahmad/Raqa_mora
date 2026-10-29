import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/server/auth";
import { karachiShift } from "@/app/api/_lib/dates";

/** Rupees → integer paisa. */
const rs = (rupees: number): number => Math.round(rupees * 100);

// Deterministic PRNG so re-seeding always produces the same demo dataset.
let seedState = 20240115;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}
function amountBetween(min: number, max: number): number {
  return Math.round((min + rand() * (max - min)) / 10) * 10;
}

const DEMO_CATEGORIES: Array<{ name: string; kind: "INCOME" | "EXPENSE"; icon: string }> = [
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

type TxnSpec = {
  type: string;
  amount: number;
  date: Date;
  note?: string | null;
  reason?: string | null;
  signed?: number;
  accountId?: string | null;
  toAccountId?: string | null;
  categoryId?: string | null;
  personId?: string | null;
  debtId?: string | null;
};

/**
 * POST /api/demo/seed — wipe the user's financial data and seed a realistic,
 * Pakistan-themed demo dataset: accounts, categories, people with debts
 * (including a partially repaid one and an overdue one), ~3 months of
 * transactions, budgets, savings goals and recurring rules.
 */
export async function POST() {
  try {
    const session = await requireUser();

    await db.$transaction(async (tx) => {
      // ---------- wipe existing data (FK-safe order) ----------
      await tx.transaction.deleteMany({ where: { userId: session.id } });
      await tx.contribution.deleteMany({ where: { goal: { userId: session.id } } });
      await tx.savingsGoal.deleteMany({ where: { userId: session.id } });
      await tx.debt.deleteMany({ where: { userId: session.id } });
      await tx.budget.deleteMany({ where: { userId: session.id } });
      await tx.recurringRule.deleteMany({ where: { userId: session.id } });
      await tx.notification.deleteMany({ where: { userId: session.id } });
      await tx.person.deleteMany({ where: { userId: session.id } });
      await tx.category.deleteMany({ where: { userId: session.id } });
      await tx.account.deleteMany({ where: { userId: session.id } });

      // ---------- Karachi date helpers ----------
      const nowKar = karachiShift(new Date());
      const baseY = nowKar.getUTCFullYear();
      const baseM = nowKar.getUTCMonth();
      const baseD = nowKar.getUTCDate();
      /** Karachi wall-clock noon, N days from today (negative = past). */
      const dayOffset = (n: number): Date =>
        new Date(Date.UTC(baseY, baseM, baseD + n, 12, 0, 0) - 5 * 60 * 60 * 1000);
      /** Karachi wall-clock noon on day `d` of the month `i` months ago (negative = past). */
      const dayOfMonth = (i: number, d: number): Date =>
        new Date(Date.UTC(baseY, baseM - i, d, 12, 0, 0) - 5 * 60 * 60 * 1000);

      // ---------- accounts ----------
      const cash = await tx.account.create({
        data: { userId: session.id, name: "Cash", type: "CASH", openingBalance: rs(25000), color: "#16836F", icon: "banknote" },
      });
      const hbl = await tx.account.create({
        data: { userId: session.id, name: "HBL Bank", type: "BANK", openingBalance: rs(85000), color: "#0E6E5C", icon: "landmark" },
      });
      const easypaisa = await tx.account.create({
        data: { userId: session.id, name: "Easypaisa", type: "EASYPAISA", openingBalance: rs(6500), color: "#7A9E3B", icon: "smartphone" },
      });

      // ---------- categories ----------
      await tx.category.createMany({
        data: DEMO_CATEGORIES.map((c) => ({ ...c, userId: session.id })),
      });
      const categoryRows = await tx.category.findMany({ where: { userId: session.id } });
      const cat = new Map(categoryRows.map((c) => [c.name, c.id] as const));

      // ---------- people ----------
      const ali = await tx.person.create({
        data: { userId: session.id, name: "Ali Raza", phone: "0300-1234567", notes: "Office colleague — Gulberg" },
      });
      const hassan = await tx.person.create({
        data: { userId: session.id, name: "Hassan Sheikh", phone: "0321-7654321", notes: "University friend" },
      });
      const fatima = await tx.person.create({
        data: { userId: session.id, name: "Fatima Khan", phone: "0333-2223344" },
      });

      // ---------- debts (mixed, incl. partial repayment + overdue) ----------
      const debtAli = await tx.debt.create({
        data: {
          userId: session.id, personId: ali.id, direction: "RECEIVABLE",
          principal: rs(15000), note: "Helped Ali cover his rent",
          dueDate: dayOffset(10), status: "ACTIVE",
        },
      });
      const debtHassan = await tx.debt.create({
        data: {
          userId: session.id, personId: hassan.id, direction: "PAYABLE",
          principal: rs(8000), note: "Borrowed for laptop repair",
          dueDate: dayOffset(5), status: "ACTIVE",
        },
      });
      const debtFatima = await tx.debt.create({
        data: {
          userId: session.id, personId: fatima.id, direction: "RECEIVABLE",
          principal: rs(3500), note: "Lent for course fee", dueDate: null, status: "SETTLED",
        },
      });
      const debtAliPayable = await tx.debt.create({
        data: {
          userId: session.id, personId: ali.id, direction: "PAYABLE",
          principal: rs(2500), note: "Owed from chai dhaba run",
          dueDate: dayOffset(-3), status: "ACTIVE",
        },
      });

      // ---------- transactions (~3 months) ----------
      const specs: TxnSpec[] = [];
      const add = (s: TxnSpec) => specs.push(s);

      // Salary on the 1st of each of the last 3 months
      for (let i = 2; i >= 0; i--) {
        add({
          type: "INCOME", amount: rs(95000), date: dayOfMonth(i, 1),
          note: `Monthly salary — TechVerse Solutions (${dayOfMonth(i, 1).toISOString().slice(0, 7)})`,
          accountId: hbl.id, categoryId: cat.get("Salary") ?? null,
        });
      }
      // Freelancing income
      add({ type: "INCOME", amount: rs(25000), date: dayOffset(-75), note: "Upwork — dashboard revamp", accountId: hbl.id, categoryId: cat.get("Freelancing") ?? null });
      add({ type: "INCOME", amount: rs(18000), date: dayOffset(-47), note: "Upwork — API integration", accountId: hbl.id, categoryId: cat.get("Freelancing") ?? null });
      add({ type: "INCOME", amount: rs(22000), date: dayOffset(-18), note: "Fiverr — React bug fixes", accountId: hbl.id, categoryId: cat.get("Freelancing") ?? null });

      // Rent on the 5th of each month
      for (let i = 2; i >= 0; i--) {
        add({ type: "EXPENSE", amount: rs(35000), date: dayOfMonth(i, 5), note: "House rent — Gulberg flat", accountId: hbl.id, categoryId: cat.get("Rent") ?? null });
      }
      // Utilities
      const electricity = [rs(11500), rs(12800), rs(12200)];
      for (let i = 2; i >= 0; i--) {
        add({ type: "EXPENSE", amount: electricity[2 - i], date: dayOfMonth(i, 10), note: `LESCO electricity bill (${dayOfMonth(i, 10).toISOString().slice(0, 7)})`, accountId: hbl.id, categoryId: cat.get("Bills & Utilities") ?? null });
        add({ type: "EXPENSE", amount: rs(5000), date: dayOfMonth(i, 12), note: "PTCL internet", accountId: hbl.id, categoryId: cat.get("Bills & Utilities") ?? null });
      }
      // Subscriptions
      for (let i = 2; i >= 0; i--) {
        add({ type: "EXPENSE", amount: rs(2500), date: dayOfMonth(i, 8), note: "Netflix subscription", accountId: hbl.id, categoryId: cat.get("Subscriptions") ?? null });
        add({ type: "EXPENSE", amount: rs(299), date: dayOfMonth(i, 15), note: "Spotify Premium", accountId: easypaisa.id, categoryId: cat.get("Subscriptions") ?? null });
      }

      // Weekly groceries across the last ~12 weeks
      const groceryStores = ["Imtiaz Super Market", "Al-Fatah", "Chase Up", "Sabzi Mandi", "Utility Store", "Bakra Habib"];
      for (let k = 0; k < 12; k++) {
        add({
          type: "EXPENSE", amount: rs(amountBetween(2200, 9500)), date: dayOffset(-(84 - k * 7)),
          note: pick(groceryStores),
          accountId: k % 2 === 0 ? cash.id : easypaisa.id,
          categoryId: cat.get("Food & Groceries") ?? null,
        });
      }
      // Rides & fuel every ~5 days
      const rides = ["Careem ride", "Petrol top-up", "Bykea delivery", "Metro bus card", "Rickshaw fare"];
      for (let k = 0; k < 16; k++) {
        add({
          type: "EXPENSE", amount: rs(amountBetween(450, 2300)), date: dayOffset(-(82 - k * 5)),
          note: pick(rides),
          accountId: k % 3 === 0 ? easypaisa.id : cash.id,
          categoryId: cat.get("Transport") ?? null,
        });
      }
      // Misc lifestyle
      add({ type: "EXPENSE", amount: rs(6900), date: dayOffset(-55), note: "Daraz — home items", accountId: cash.id, categoryId: cat.get("Shopping") ?? null });
      add({ type: "EXPENSE", amount: rs(4800), date: dayOffset(-20), note: "Kurta & shoes — Eid sale", accountId: easypaisa.id, categoryId: cat.get("Shopping") ?? null });
      add({ type: "EXPENSE", amount: rs(7500), date: dayOffset(-40), note: "Udemy course", accountId: cash.id, categoryId: cat.get("Education") ?? null });
      add({ type: "EXPENSE", amount: rs(3200), date: dayOffset(-65), note: "Pharmacy — Dawaai", accountId: cash.id, categoryId: cat.get("Health") ?? null });
      add({ type: "EXPENSE", amount: rs(12000), date: dayOffset(-78), note: "Niazi Express bus tickets", accountId: hbl.id, categoryId: cat.get("Travel") ?? null });

      // One transfer + one refund
      add({ type: "TRANSFER", amount: rs(5000), date: dayOffset(-9), note: "Top-up Easypaisa", accountId: cash.id, toAccountId: easypaisa.id });
      add({ type: "REFUND", amount: rs(4200), date: dayOffset(-6), note: "Refund — returned online order", accountId: easypaisa.id, categoryId: cat.get("Shopping") ?? null });

      // Debt lifecycle transactions
      add({ type: "LENT", amount: rs(15000), date: dayOffset(-45), note: "Lent to Ali Raza", accountId: cash.id, personId: ali.id, debtId: debtAli.id });
      add({ type: "REPAYMENT_RECEIVED", amount: rs(5000), date: dayOffset(-20), note: "Partial repayment from Ali Raza", accountId: cash.id, personId: ali.id, debtId: debtAli.id });
      add({ type: "BORROWED", amount: rs(8000), date: dayOffset(-30), note: "Borrowed from Hassan Sheikh", accountId: hbl.id, personId: hassan.id, debtId: debtHassan.id });
      add({ type: "LENT", amount: rs(3500), date: dayOffset(-60), note: "Lent to Fatima Khan", accountId: cash.id, personId: fatima.id, debtId: debtFatima.id });
      add({ type: "REPAYMENT_RECEIVED", amount: rs(3500), date: dayOffset(-25), note: "Full repayment from Fatima Khan", accountId: easypaisa.id, personId: fatima.id, debtId: debtFatima.id });
      add({ type: "BORROWED", amount: rs(2500), date: dayOffset(-50), note: "Borrowed from Ali Raza", accountId: cash.id, personId: ali.id, debtId: debtAliPayable.id });
      add({ type: "REPAYMENT_MADE", amount: rs(1000), date: dayOffset(-15), note: "Partial payment to Ali Raza", accountId: cash.id, personId: ali.id, debtId: debtAliPayable.id });

      for (const s of specs) {
        await tx.transaction.create({
          data: {
            userId: session.id,
            type: s.type,
            amount: s.amount,
            signed: s.signed ?? 1,
            date: s.date,
            note: s.note ?? null,
            reason: s.reason ?? null,
            accountId: s.accountId ?? null,
            toAccountId: s.toAccountId ?? null,
            categoryId: s.categoryId ?? null,
            personId: s.personId ?? null,
            debtId: s.debtId ?? null,
          },
        });
      }

      // ---------- budgets (current Karachi month) ----------
      const monthKey = nowKar.toISOString().slice(0, 7);
      await tx.budget.createMany({
        data: [
          { userId: session.id, categoryId: cat.get("Food & Groceries")!, amount: rs(20000), month: monthKey },
          { userId: session.id, categoryId: cat.get("Transport")!, amount: rs(8000), month: monthKey },
        ],
      });

      // ---------- savings goals + contributions ----------
      const umrah = await tx.savingsGoal.create({
        data: {
          userId: session.id, name: "Umrah Fund", targetAmount: rs(300000),
          targetDate: new Date(Date.UTC(baseY, baseM + 10, 15, 12, 0, 0) - 5 * 60 * 60 * 1000),
          note: "Insha'Allah next year",
        },
      });
      const emergency = await tx.savingsGoal.create({
        data: {
          userId: session.id, name: "Emergency Fund", targetAmount: rs(150000),
          targetDate: new Date(Date.UTC(baseY, baseM + 6, 1, 12, 0, 0) - 5 * 60 * 60 * 1000),
          note: "3 months of expenses",
        },
      });
      await tx.contribution.createMany({
        data: [
          { goalId: umrah.id, amount: rs(10000), date: dayOffset(-30), note: "First deposit" },
          { goalId: emergency.id, amount: rs(25000), date: dayOffset(-60), note: "Monthly saving" },
        ],
      });

      // ---------- recurring rules ----------
      await tx.recurringRule.createMany({
        data: [
          {
            userId: session.id, title: "Netflix Subscription", type: "EXPENSE", amount: rs(2500),
            frequency: "MONTHLY", nextDate: dayOffset(6), accountId: hbl.id,
            categoryId: cat.get("Subscriptions")!, note: "Billed monthly",
          },
          {
            userId: session.id, title: "Monthly Savings Transfer", type: "TRANSFER", amount: rs(10000),
            frequency: "MONTHLY", nextDate: dayOffset(3), accountId: hbl.id, toAccountId: easypaisa.id,
            note: "Move savings on payday",
          },
        ],
      });

      // ---------- mark user as demo ----------
      await tx.user.update({
        where: { id: session.id },
        data: { isDemo: true, onboarded: true },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
