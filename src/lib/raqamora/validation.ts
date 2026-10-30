import { z } from "zod";
import { TXN_TYPES, ACCOUNT_TYPES } from "@/lib/raqamora/finance";

/** Positive integer paisa amount. */
const paisa = z.number({ message: "Amount is required" }).int().positive("Amount must be greater than zero");

export const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(80),
    email: z.string().email("Enter a valid email address").max(160),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const onboardingSchema = z.object({
  name: z.string().min(1).max(80),
  accountName: z.string().min(1, "Account name is required").max(60),
  accountType: z.enum(ACCOUNT_TYPES),
  openingBalanceRupees: z.number().min(0).max(1_000_000_000),
});

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  type: z.enum(ACCOUNT_TYPES),
  openingBalanceRupees: z.number().min(-1_000_000_000).max(1_000_000_000).default(0),
  color: z.string().max(20).default("#16836F"),
  icon: z.string().max(30).default("wallet"),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  kind: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().max(30).default("tag"),
});

export const personSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const transactionSchema = z
  .object({
    type: z.enum(TXN_TYPES),
    amountRupees: z.number({ message: "Amount is required" }).positive("Amount must be greater than zero").max(1_000_000_000),
    date: z.string().min(1, "Date is required"),
    note: z.string().max(500).optional().nullable(),
    accountId: z.string().optional().nullable(),
    toAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    personId: z.string().optional().nullable(),
    debtId: z.string().optional().nullable(),
    reason: z.string().optional().nullable(),
    adjustDirection: z.enum(["INCREASE", "DECREASE"]).optional(),
  })
  .superRefine((v, ctx) => {
    const t = v.type;
    if (t !== "TRANSFER" && !v.accountId) ctx.addIssue({ code: "custom", message: "Account is required", path: ["accountId"] });
    if (t === "TRANSFER") {
      if (!v.accountId) ctx.addIssue({ code: "custom", message: "From account is required", path: ["accountId"] });
      if (!v.toAccountId) ctx.addIssue({ code: "custom", message: "To account is required", path: ["toAccountId"] });
      if (v.accountId && v.accountId === v.toAccountId)
        ctx.addIssue({ code: "custom", message: "Source and destination must differ", path: ["toAccountId"] });
    }
    if ((t === "INCOME" || t === "EXPENSE" || t === "REFUND") && !v.categoryId)
      ctx.addIssue({ code: "custom", message: "Category is required", path: ["categoryId"] });
    if (["LENT", "BORROWED", "REPAYMENT_RECEIVED", "REPAYMENT_MADE"].includes(t) && !v.personId)
      ctx.addIssue({ code: "custom", message: "Person is required", path: ["personId"] });
    if (t === "ADJUSTMENT" && !v.reason?.trim())
      ctx.addIssue({ code: "custom", message: "A reason is required for adjustments", path: ["reason"] });
  });

export const debtSchema = z.object({
  personId: z.string().min(1, "Person is required"),
  direction: z.enum(["RECEIVABLE", "PAYABLE"]),
  principalRupees: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  note: z.string().max(500).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  recordNow: z.boolean().default(true),
});

export const repaymentSchema = z.object({
  debtId: z.string().min(1),
  amountRupees: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  accountId: z.string().min(1, "Account is required"),
  date: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  amountRupees: z.number().positive("Budget must be greater than zero").max(1_000_000_000),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
});

export const goalSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  targetAmountRupees: z.number().positive("Target must be greater than zero").max(1_000_000_000),
  targetDate: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export const contributionSchema = z.object({
  amountRupees: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  date: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

export const recurringSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(80),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    amountRupees: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    nextDate: z.string().min(1, "Next date is required"),
    endDate: z.string().optional().nullable(),
    note: z.string().max(500).optional().nullable(),
    accountId: z.string().optional().nullable(),
    toAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "TRANSFER" && (!v.accountId || !v.toAccountId || v.accountId === v.toAccountId))
      ctx.addIssue({ code: "custom", message: "Transfer needs two different accounts", path: ["toAccountId"] });
    if (v.type !== "TRANSFER" && !v.accountId)
      ctx.addIssue({ code: "custom", message: "Account is required", path: ["accountId"] });
    if (v.type !== "TRANSFER" && !v.categoryId)
      ctx.addIssue({ code: "custom", message: "Category is required", path: ["categoryId"] });
  });

export const settingsSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  warnThreshold: z.number().int().min(10).max(100).optional(),
});
