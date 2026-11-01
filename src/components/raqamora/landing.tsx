"use client";

/**
 * RAQAMORA — Premium Financial OS Landing Page
 * Completely redesigned for modern aesthetics (Stripe/Linear/Mercury tier),
 * interactive micro-interactions, rich animations, dark/light compatibility,
 * and comprehensive SEO, AEO (Answer Engine Optimization) & GEO (Generative Engine Optimization).
 * 100% Fully responsive across Mobile (320px+), Tablet, and Desktop.
 */
import * as React from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  HandCoins,
  HelpCircle,
  Laptop,
  Lock,
  Menu,
  Minus,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Scale,
  ShieldCheck,
  Sigma,
  Smartphone,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Wallet,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

import type { SessionUser } from "@/lib/raqamora/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoButton, Money } from "@/components/raqamora/kit";
import { RaqamoraWordmark, Monogram } from "@/components/raqamora/brand";
import { LanguageSwitcher } from "@/components/raqamora/language-switcher";
import { formatPKR } from "@/lib/raqamora/money";

export interface LandingProps {
  onEnterApp: (user: SessionUser) => void;
  onSignIn: (mode: "login" | "signup") => void;
}

/* ------------------------------------------------------------- Animations */

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------- Interactive Mockup Tabs */

type MockupTab = "wallets" | "khata" | "budgets" | "savings";

function InteractiveFinancialMockup() {
  const [activeTab, setActiveTab] = React.useState<MockupTab>("wallets");

  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Main glass frame with ambient glowing orbs enclosed */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-hairline/80 bg-white/90 p-3.5 sm:p-6 shadow-raised backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1320]/90">
        {/* Decorative ambient glowing orbs - placed inside overflow-hidden to guarantee zero page overflow */}
        <div className="pointer-events-none absolute -left-10 -top-10 size-44 rounded-full bg-brand-emerald/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 size-44 rounded-full bg-gold/15 blur-3xl" />

        {/* Mock OS Header */}
        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-hairline/60 pb-3 sm:pb-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex size-2.5 sm:size-3 rounded-full bg-red-400/80" />
            <span className="flex size-2.5 sm:size-3 rounded-full bg-amber-400/80" />
            <span className="flex size-2.5 sm:size-3 rounded-full bg-emerald-400/80" />
            <span className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-soft truncate">
              RAQAMORA Live OS
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex size-2 animate-pulse rounded-full bg-brand-emerald" />
            <span className="text-[10px] sm:text-[11px] font-semibold text-brand-emerald">
              PKT Active
            </span>
          </div>
        </div>

        {/* Tab Switcher - Responsive 4-column layout on all mobile screens */}
        <div className="relative z-10 mt-3 sm:mt-4 grid grid-cols-4 gap-1 rounded-xl sm:rounded-2xl border border-hairline/80 bg-muted/50 p-1 dark:border-white/10 dark:bg-white/5">
          {(
            [
              { id: "wallets", label: "Wallets", shortLabel: "Wallets", icon: Wallet },
              { id: "khata", label: "Digital Khata", shortLabel: "Khata", icon: Users },
              { id: "budgets", label: "Monthly Budget", shortLabel: "Budget", icon: Target },
              { id: "savings", label: "Savings Intel", shortLabel: "Savings", icon: PiggyBank },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex min-h-8 items-center justify-center gap-1 rounded-lg sm:rounded-xl px-1.5 sm:px-3 text-center transition-all duration-200 active:scale-95 ${
                  isActive
                    ? "bg-white text-ink shadow-2xs dark:bg-card dark:text-white"
                    : "text-ink-soft hover:text-ink dark:hover:text-white"
                }`}
              >
                <Icon className="size-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
                <span className="truncate text-[11px] sm:text-xs font-semibold">
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Tab Content */}
        <div className="relative z-10 mt-3.5 sm:mt-4 min-h-[290px]">
          <AnimatePresence mode="wait">
            {activeTab === "wallets" && (
              <motion.div
                key="wallets"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-2.5 sm:space-y-3"
              >
                {/* Total Balance Card */}
                <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#0b1320] via-[#111c2e] to-[#080d17] p-3.5 sm:p-5 text-white shadow-md">
                  <div className="flex items-center justify-between gap-2 text-xs text-white/70">
                    <span className="truncate">Total Consolidated Balance</span>
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] sm:text-xs text-emerald-300 shrink-0">
                      Live Reconciled
                    </Badge>
                  </div>
                  <div className="mt-2 text-xl sm:text-3xl font-extrabold text-white">
                    ₨ 241,150.00
                  </div>
                  <p className="mt-1 text-[10px] sm:text-[11px] text-white/60">
                    Across 4 primary accounts · 0 floating-point rounding error
                  </p>
                </div>

                {/* Wallets grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <div className="rounded-xl border border-hairline/80 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] sm:text-xs font-semibold text-ink truncate">Cash in Hand</span>
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    </div>
                    <div className="mt-1 text-xs sm:text-sm font-bold text-ink truncate">₨ 34,500</div>
                    <span className="text-[10px] text-ink-soft block truncate">Physical Cash</span>
                  </div>

                  <div className="rounded-xl border border-hairline/80 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] sm:text-xs font-semibold text-ink truncate">Meezan Bank</span>
                      <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                    </div>
                    <div className="mt-1 text-xs sm:text-sm font-bold text-ink truncate">₨ 185,400</div>
                    <span className="text-[10px] text-ink-soft block truncate">Salary / Savings</span>
                  </div>

                  <div className="rounded-xl border border-hairline/80 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] sm:text-xs font-semibold text-ink truncate">JazzCash</span>
                      <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                    </div>
                    <div className="mt-1 text-xs sm:text-sm font-bold text-ink truncate">₨ 12,350</div>
                    <span className="text-[10px] text-ink-soft block truncate">Mobile Wallet</span>
                  </div>

                  <div className="rounded-xl border border-hairline/80 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] sm:text-xs font-semibold text-ink truncate">Easypaisa</span>
                      <span className="size-2 rounded-full bg-emerald-600 shrink-0" />
                    </div>
                    <div className="mt-1 text-xs sm:text-sm font-bold text-ink truncate">₨ 8,900</div>
                    <span className="text-[10px] text-ink-soft block truncate">Utility &amp; Bills</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 rounded-xl border border-brand-emerald/30 bg-brand-emerald/5 px-3 py-2 text-[11px] sm:text-xs font-medium text-brand-emerald-deep dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 truncate">
                    <ArrowLeftRight className="size-3.5 shrink-0" />
                    <span className="truncate">Internal transfers never inflate spending</span>
                  </span>
                  <span className="font-bold shrink-0 self-end sm:self-auto">Verified</span>
                </div>
              </motion.div>
            )}

            {activeTab === "khata" && (
              <motion.div
                key="khata"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-2.5 sm:space-y-3"
              >
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-card p-3 border border-hairline/80 shadow-2xs dark:border-white/10">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-xs font-semibold text-ink-soft block">Receivables (Lent)</span>
                    <div className="text-base sm:text-lg font-extrabold text-money-pos">₨ 22,500</div>
                  </div>
                  <div className="text-right min-w-0">
                    <span className="text-[10px] sm:text-xs font-semibold text-ink-soft block">Payables (Borrowed)</span>
                    <div className="text-base sm:text-lg font-extrabold text-money-neg">₨ 4,000</div>
                  </div>
                </div>

                {/* Ledger items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline/70 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl bg-brand-emerald/15 font-bold text-xs sm:text-sm text-brand-emerald-deep dark:text-emerald-300">
                        AR
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink truncate">Ali Raza (Friend)</div>
                        <div className="text-[10px] sm:text-[11px] text-ink-soft truncate">Lent for laptop · Due Nov 15</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold text-money-pos">owes ₨ 15,000</div>
                      <span className="text-[10px] text-ink-soft block">2 repayments</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline/70 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 font-bold text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                        UK
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink truncate">Usman Kiryana Store</div>
                        <div className="text-[10px] sm:text-[11px] text-ink-soft truncate">Monthly grocery khata</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold text-money-neg">you owe ₨ 4,000</div>
                      <span className="text-[10px] text-ink-soft block">Due 1st Nov</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline/70 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-xs sm:text-sm text-slate-700 dark:bg-white/10 dark:text-white">
                        ZS
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink truncate">Zubair Shah</div>
                        <div className="text-[10px] sm:text-[11px] text-ink-soft truncate">Dinner bill split</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="border-hairline text-[10px] font-semibold text-ink-soft">
                        Settled
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] sm:text-[11px] text-ink-soft">
                  One-click printable statement &amp; WhatsApp share available.
                </div>
              </motion.div>
            )}

            {activeTab === "budgets" && (
              <motion.div
                key="budgets"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-2.5 sm:space-y-3"
              >
                <div className="rounded-xl border border-hairline/80 bg-card p-3 sm:p-3.5 shadow-2xs dark:border-white/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-semibold">
                    <span className="text-ink">November 2026 Budget Target</span>
                    <span className="text-brand-emerald">₨ 20,000 Limit</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-[11px] sm:text-xs text-ink-soft">
                    <span>Spent: ₨ 13,400 (67%)</span>
                    <span className="font-semibold text-brand-emerald">₨ 6,600 Remaining</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[67%] rounded-full bg-brand-emerald" />
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-2.5">
                  <div className="rounded-xl border border-hairline/70 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-ink gap-2">
                      <span className="truncate">Food &amp; Groceries</span>
                      <span className="text-amber-600 shrink-0 text-[11px] sm:text-xs">82% (Warning)</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[82%] rounded-full bg-amber-500" />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
                      <span>₨ 8,200 spent</span>
                      <span>₨ 10,000 limit</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-hairline/70 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-ink gap-2">
                      <span className="truncate">Clothing &amp; Shopping</span>
                      <span className="text-brand-emerald shrink-0 text-[11px] sm:text-xs">44% (Healthy)</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[44%] rounded-full bg-brand-emerald" />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
                      <span>₨ 2,200 spent</span>
                      <span>₨ 5,000 limit</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-hairline/70 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-ink gap-2">
                      <span className="truncate">Fuel &amp; Commute</span>
                      <span className="text-brand-emerald shrink-0 text-[11px] sm:text-xs">60% (Healthy)</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[60%] rounded-full bg-brand-emerald" />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
                      <span>₨ 3,000 spent</span>
                      <span>₨ 5,000 limit</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "savings" && (
              <motion.div
                key="savings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-2.5 sm:space-y-3"
              >
                <div className="rounded-xl sm:rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 sm:p-4 dark:border-emerald-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                      Savings Intelligence
                    </span>
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/20 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                      +₨ 8,500 Higher
                    </Badge>
                  </div>
                  <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-200">
                    ₨ 38,500 Saved This Month
                  </div>
                  <p className="mt-1 text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    Aap ne pichle mahine se <strong>+₨ 8,500</strong> ziada bachat ki hai! 🎉
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <div className="rounded-xl border border-hairline/80 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10 min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-medium text-ink-soft block truncate">October Savings</span>
                    <div className="mt-1 text-sm sm:text-base font-extrabold text-ink truncate">₨ 30,000</div>
                    <span className="text-[10px] text-ink-soft block truncate">21.4% of income</span>
                  </div>
                  <div className="rounded-xl border border-hairline/80 bg-card p-2.5 sm:p-3 shadow-2xs dark:border-white/10 min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-medium text-ink-soft block truncate">November Savings</span>
                    <div className="mt-1 text-sm sm:text-base font-extrabold text-money-pos truncate">₨ 38,500</div>
                    <span className="text-[10px] text-money-pos font-semibold block truncate">27.5% of income</span>
                  </div>
                </div>

                <div className="rounded-xl border border-hairline/80 bg-card p-2.5 sm:p-3 text-[11px] sm:text-xs text-ink-soft dark:border-white/10">
                  <span className="font-semibold text-ink">Active Goal:</span> Emergency Fund (₨ 75,000 / ₨ 100,000) · 75%
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating feature pills - carefully positioned on desktop to prevent overflow */}
      <div className="pointer-events-none absolute -bottom-3 -left-3 hidden lg:flex items-center gap-2 rounded-2xl border border-hairline/80 bg-white/95 px-3 py-2 shadow-raised backdrop-blur-md dark:border-white/10 dark:bg-card/95 z-20">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-brand-emerald/15 text-brand-emerald-deep dark:text-emerald-300">
          <ShieldCheck className="size-4" />
        </span>
        <div className="text-left">
          <p className="text-xs font-bold text-ink">100% Exact Paisa Math</p>
          <p className="text-[10px] text-ink-soft">Integer paisa precision</p>
        </div>
      </div>

      <div className="pointer-events-none absolute -top-3 -right-3 hidden lg:flex items-center gap-2 rounded-2xl border border-hairline/80 bg-white/95 px-3 py-2 shadow-raised backdrop-blur-md dark:border-white/10 dark:bg-card/95 z-20">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-deep dark:text-amber-400">
          <WifiOff className="size-4" />
        </span>
        <div className="text-left">
          <p className="text-xs font-bold text-ink">Offline Ready PWA</p>
          <p className="text-[10px] text-ink-soft">Works without internet</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------- Interactive Savings Calculator */

function SavingsCalculatorWidget() {
  const [monthlyIncome, setMonthlyIncome] = React.useState<number>(100000);
  const [monthlyExpense, setMonthlyExpense] = React.useState<number>(75000);

  const currentSavings = Math.max(0, monthlyIncome - monthlyExpense);
  const optimizedExpense = Math.round(monthlyExpense * 0.85); // 15% saving through mindful budgeting
  const optimizedSavings = monthlyIncome - optimizedExpense;
  const extraMonthlySavings = optimizedSavings - currentSavings;
  const yearlyProjectedExtra = extraMonthlySavings * 12;

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-4 sm:p-8 shadow-raised dark:border-white/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Badge variant="outline" className="border-gold/40 bg-gold/10 text-xs font-bold text-gold-deep">
            Interactive Calculator
          </Badge>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
            See How Much You Can Save with RAQAMORA
          </h3>
          <p className="text-xs text-ink-soft sm:text-sm">
            Adjust your monthly income &amp; spending to estimate your potential annual growth.
          </p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-brand-emerald/30 bg-brand-emerald/10 p-3.5 sm:p-4 text-center shrink-0">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-brand-emerald-deep dark:text-emerald-300">
            Projected Extra 1-Year Wealth
          </span>
          <div className="mt-1 text-xl sm:text-2xl font-black text-brand-emerald-deep dark:text-emerald-300">
            ₨ {yearlyProjectedExtra.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mt-8 grid gap-6 md:grid-cols-2">
        <div className="space-y-5 sm:space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs sm:text-sm font-semibold text-ink">
              <span>Monthly Household Income:</span>
              <span className="font-bold text-brand-emerald-deep dark:text-emerald-300">
                ₨ {monthlyIncome.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={30000}
              max={500000}
              step={5000}
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-brand-emerald"
            />
            <div className="flex justify-between text-[10px] sm:text-[11px] text-ink-soft">
              <span>₨ 30k</span>
              <span>₨ 250k</span>
              <span>₨ 500k+</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs sm:text-sm font-semibold text-ink">
              <span>Current Monthly Expenses:</span>
              <span className="font-bold text-money-neg">
                ₨ {monthlyExpense.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={20000}
              max={monthlyIncome}
              step={5000}
              value={monthlyExpense}
              onChange={(e) => setMonthlyExpense(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] sm:text-[11px] text-ink-soft">
              <span>₨ 20k</span>
              <span>₨ {Math.round(monthlyIncome / 2).toLocaleString()}</span>
              <span>₨ {monthlyIncome.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-hairline/60 bg-muted/30 p-3 sm:p-4 dark:border-white/5 dark:bg-white/5">
          <div className="rounded-xl bg-card p-3 shadow-2xs border border-hairline/60 dark:border-white/10">
            <span className="text-[10px] sm:text-[11px] font-medium text-ink-soft block truncate">Current Monthly Savings</span>
            <div className="mt-1 text-base sm:text-lg font-bold text-ink">₨ {currentSavings.toLocaleString()}</div>
            <span className="text-[10px] text-ink-soft block">Unstructured spending</span>
          </div>

          <div className="rounded-xl bg-card p-3 shadow-2xs border border-hairline/60 dark:border-white/10">
            <span className="text-[10px] sm:text-[11px] font-medium text-ink-soft block truncate">With RAQAMORA Budgeting</span>
            <div className="mt-1 text-base sm:text-lg font-extrabold text-money-pos">
              ₨ {optimizedSavings.toLocaleString()}
            </div>
            <span className="text-[10px] font-semibold text-brand-emerald block">+15% leak reduction</span>
          </div>

          <div className="sm:col-span-2 rounded-xl bg-gradient-to-r from-brand-emerald/10 to-gold/10 p-3 sm:p-3.5 border border-brand-emerald/20 text-center">
            <span className="text-xs font-semibold text-ink">
              Aap har mahine lagbhag{" "}
              <strong className="text-brand-emerald-deep dark:text-emerald-300">
                +₨ {extraMonthlySavings.toLocaleString()}
              </strong>{" "}
              ziada bacha sakte hain!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- FAQ Section */

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Kya RAQAMORA mukammal tor par free hai?",
    a: "Ji haan, RAQAMORA 100% free hai. Is mein koi hidden charges ya credit card requirement nahi hai. Aap baghair kisi rukawat ke apne tamam accounts, khata aur budgets manage kar sakte hain.",
  },
  {
    q: "RAQAMORA Cash, Bank, JazzCash aur Easypaisa ko ek sath kaise handle karta hai?",
    a: "RAQAMORA har wallet ko first-class account manta hai. Jab aap apne Bank se JazzCash ya Cash nikalte hain to yeh 'TRANSFER' kehlata hai jo aapke kharche ko ghalat tor par double nahi karta. Is se aapka consolidated balance bilkul 100% accurate rehta hai.",
  },
  {
    q: "Digital Khata aur Udhaar kaise manage hota hai?",
    a: "Aap doston, rishtedaaron ya dukandaaron ke naam se khata khol sakte hain. Jab aap kisi ko paise den (Lent) ya len (Borrowed), to app uski date-wise repayments aur due date track karti hai. Preview karne par pore mahine ka hisab aur WhatsApp statement export kiya ja sakta hai.",
  },
  {
    q: "Kya RAQAMORA internet ke baghair (Offline) kaam karta hai?",
    a: "Bilkul! RAQAMORA ek Progressive Web App (PWA) hai. Aap ise apne Android ya iPhone par install kar sakte hain. Load shedding ya internet band hone par bhi aap foran entry kar sakte hain; connection milte hi data automatically sync ho jata hai.",
  },
  {
    q: "Integer Paisa Arithmetic kya hai aur yeh doosri apps se behtar kyun hai?",
    a: "Aam apps computer floating-point math use karti hain jisme 0.1 + 0.2 = 0.30000000000000004 jese bugs aate hain aur paise gayab ho jate hain. RAQAMORA har ek raqam ko integer paisa (1 PKR = 100 paisa) mein store karti hai, jis se banking standard ke mutabiq zero calculation error hota hai.",
  },
  {
    q: "Kya mera maali data private aur mehfooz hai?",
    a: "Aapka data 100% aapka hai. Hum koi third-party tracking ya advertising cookies use nahi karte, aur na hi aapka data kisi ko becha jata hai. Tamam communication modern 256-bit SSL encryption ke zariye mehfooz hoti hai.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl sm:rounded-2xl border border-hairline/80 bg-card transition-colors dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-3 p-4 sm:p-5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-bold text-ink sm:text-base">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-ink-soft transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-hairline/60 p-4 text-xs leading-relaxed text-ink-soft dark:border-white/10 sm:p-5 sm:text-sm">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------- Main Component */

export function Landing({ onEnterApp, onSignIn }: LandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile menu on resize to desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f8fafc] text-ink dark:bg-[#0b1320] dark:text-white">
      {/* --------------------------------------------- Top Announcement Bar */}
      <div className="bg-gradient-to-r from-brand-emerald-deep via-[#0b1320] to-gold-deep px-3 py-1.5 text-center text-[11px] font-semibold text-white sm:text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <Sparkles className="size-3.5 shrink-0 text-gold" />
          <span>
            RAQAMORA 2.0 Live · Pakistan&apos;s #1 Financial OS
          </span>
          <span className="hidden sm:inline">· Integer Paisa Precision &amp; Digital Khata</span>
          <button
            type="button"
            onClick={() => onSignIn("signup")}
            className="shrink-0 underline underline-offset-2 hover:text-gold active:opacity-80 transition-colors"
          >
            Try Free Now &rarr;
          </button>
        </div>
      </div>

      {/* -------------------------------------------------- Sticky Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-hairline/70 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#0b1320]/80">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-3.5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <RaqamoraWordmark size="sm" className="sm:hidden" />
            <RaqamoraWordmark size="md" className="hidden sm:inline-flex" />
            <Badge
              variant="outline"
              className="hidden border-brand-emerald/30 bg-brand-emerald/10 text-[10px] font-bold text-brand-emerald-deep dark:text-emerald-300 md:inline-flex"
            >
              PKR Native
            </Badge>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-5 xl:gap-8 text-xs font-semibold text-ink-soft dark:text-white/70 lg:flex">
            <a href="#features" className="hover:text-ink dark:hover:text-white transition-colors">
              Features
            </a>
            <a href="#khata" className="hover:text-ink dark:hover:text-white transition-colors">
              Digital Khata
            </a>
            <a href="#calculator" className="hover:text-ink dark:hover:text-white transition-colors">
              Savings Calculator
            </a>
            <a href="#comparison" className="hover:text-ink dark:hover:text-white transition-colors">
              Why RAQAMORA
            </a>
            <a href="#faq" className="hover:text-ink dark:hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2.5">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              className="min-h-9 font-semibold text-xs"
              onClick={() => onSignIn("login")}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              className="min-h-9 rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald font-bold text-xs text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-95 transition-all"
              onClick={() => onSignIn("signup")}
            >
              Get Started Free
            </Button>
          </div>

          {/* Mobile Right Bar: Quick CTA + Hamburger Menu Toggle */}
          <div className="flex lg:hidden items-center gap-1.5 sm:gap-2">
            <Button
              size="sm"
              className="h-8.5 sm:h-9 rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold text-white shadow-sm hover:brightness-105 active:scale-95 transition-all"
              onClick={() => onSignIn("signup")}
            >
              Get Started
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-hairline/80 bg-card text-ink hover:bg-muted active:scale-95 transition-all dark:border-white/10 dark:text-white"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* -------------------------------------------------- Mobile Slide-down Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-b border-hairline/80 bg-white/95 shadow-raised backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1320]/95 lg:hidden"
            >
              <div className="mx-auto max-w-7xl px-4 py-5 space-y-4">
                {/* Mobile Navigation Links */}
                <nav className="grid grid-cols-1 gap-1 text-sm font-semibold text-ink dark:text-white">
                  <a
                    href="#features"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-muted dark:hover:bg-white/5 transition-colors"
                  >
                    <Target className="size-4 text-brand-emerald" />
                    <span>Features</span>
                  </a>
                  <a
                    href="#khata"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-muted dark:hover:bg-white/5 transition-colors"
                  >
                    <Users className="size-4 text-brand-emerald" />
                    <span>Digital Khata &amp; Udhaar</span>
                  </a>
                  <a
                    href="#calculator"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-muted dark:hover:bg-white/5 transition-colors"
                  >
                    <Calculator className="size-4 text-gold" />
                    <span>Savings Calculator</span>
                  </a>
                  <a
                    href="#comparison"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-muted dark:hover:bg-white/5 transition-colors"
                  >
                    <Scale className="size-4 text-blue-500" />
                    <span>Why RAQAMORA OS</span>
                  </a>
                  <a
                    href="#faq"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-muted dark:hover:bg-white/5 transition-colors"
                  >
                    <HelpCircle className="size-4 text-ink-soft" />
                    <span>Frequently Asked Questions</span>
                  </a>
                </nav>

                {/* Mobile Language Switcher Row */}
                <div className="flex items-center justify-between border-t border-hairline/60 pt-3 dark:border-white/10">
                  <span className="text-xs font-medium text-ink-soft">Select Language</span>
                  <LanguageSwitcher />
                </div>

                {/* Mobile Action Buttons */}
                <div className="space-y-2 border-t border-hairline/60 pt-3 dark:border-white/10">
                  <Button
                    className="w-full min-h-11 rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald font-bold text-sm text-white shadow-md hover:brightness-105 active:scale-95 transition-all"
                    onClick={() => {
                      closeMobileMenu();
                      onSignIn("signup");
                    }}
                  >
                    Create Free Account
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                  <DemoButton
                    label="Try Live Demo"
                    className="w-full min-h-11 rounded-xl border-hairline bg-card font-semibold text-sm shadow-2xs hover:bg-muted"
                    onDemo={(user) => {
                      closeMobileMenu();
                      onEnterApp(user);
                    }}
                  />
                  <Button
                    variant="ghost"
                    className="w-full min-h-10 text-xs font-semibold text-ink-soft hover:text-ink dark:hover:text-white"
                    onClick={() => {
                      closeMobileMenu();
                      onSignIn("login");
                    }}
                  >
                    Already have an account? Sign In
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ------------------------------------------------------- Hero Section */}
      <section className="relative overflow-hidden px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-14 lg:pb-28 lg:pt-20">
        {/* Subtle grid background */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:28px_28px]" />

        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal className="space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] sm:text-xs font-bold text-gold-deep dark:text-amber-300 max-w-full">
                <span className="flex size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="leading-tight">Built for Pakistan&apos;s Financial Reality</span>
              </div>

              <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-ink dark:text-white sm:text-5xl lg:text-6xl sm:leading-[1.08] break-words">
                Aapka Paisa, <br />
                <span className="bg-gradient-to-r from-brand-emerald via-emerald-600 to-gold bg-clip-text text-transparent">
                  Mukammal Hisab.
                </span>
              </h1>

              <p className="max-w-xl text-sm sm:text-base lg:text-lg leading-relaxed text-ink-soft dark:text-white/70">
                Stop guessing where your salary vanished. Reconcile <strong>Cash, Bank, JazzCash &amp; Easypaisa</strong> in
                one unified dashboard. Track who owes you with <strong>Digital Khata</strong>, enforce strict monthly budgets,
                and see exactly how much you saved compared to last month.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Button
                  size="lg"
                  className="w-full sm:w-auto min-h-12 justify-center rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald px-6 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-105 active:scale-95 transition-all"
                  onClick={() => onSignIn("signup")}
                >
                  Create Free Account
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                <DemoButton
                  size="lg"
                  variant="outline"
                  label="Try Live Demo"
                  className="w-full sm:w-auto min-h-12 justify-center rounded-xl border-hairline bg-white/90 text-sm font-bold shadow-2xs hover:bg-muted dark:border-white/10 dark:bg-card"
                  onDemo={onEnterApp}
                />
              </div>

              {/* Trust Checkpoints */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-ink-soft dark:text-white/60">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-emerald" /> 100% Free · No Card
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-emerald" /> Offline PWA Installed
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-emerald" /> Zero Tracking / Privacy
                </span>
              </div>
            </Reveal>

            {/* Interactive Hero Preview */}
            <Reveal delay={0.15}>
              <InteractiveFinancialMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Stats Bar / Social Proof */}
      <section className="border-y border-hairline/80 bg-white/60 py-6 sm:py-8 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-6 md:grid-cols-4">
          <div className="text-center">
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-ink dark:text-white">₨ 150M+</div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-ink-soft">PKR Reconciled</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-brand-emerald">100%</div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-ink-soft">Paisa Precision (No Bugs)</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gold-deep dark:text-amber-400">0 Ads</div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-ink-soft">Zero Tracking Or Data Selling</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-ink dark:text-white">Offline PWA</div>
            <div className="mt-1 text-[11px] sm:text-xs font-semibold text-ink-soft">Airplane &amp; Load Shedding</div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Problem vs Solution */}
      <section id="comparison" className="scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <Reveal className="text-center">
            <Badge variant="outline" className="border-gold/40 bg-gold/10 text-xs font-bold text-gold-deep">
              The Pakistani Reality
            </Badge>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink dark:text-white sm:text-3xl lg:text-4xl">
              Purana Hisab Kitab vs RAQAMORA OS
            </h2>
            <p className="mx-auto mt-2 sm:mt-3 max-w-2xl text-xs sm:text-sm lg:text-base text-ink-soft">
              Why paper registers, WhatsApp notes, and generic foreign budgeting apps fail in Pakistan.
            </p>
          </Reveal>

          <div className="mt-8 sm:mt-12 grid gap-6 md:grid-cols-2">
            {/* The Old Way */}
            <Reveal delay={0.05} className="rounded-2xl sm:rounded-3xl border border-rose-500/20 bg-rose-500/[0.03] p-5 sm:p-8">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <Minus className="size-5 shrink-0" />
                <h3 className="text-base sm:text-lg font-bold">The Old, Broken Way</h3>
              </div>
              <ul className="mt-5 sm:mt-6 space-y-3.5 sm:space-y-4 text-xs sm:text-sm text-ink-soft dark:text-white/70">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold shrink-0">✕</span>
                  <span><strong>Paper Registers &amp; Diari:</strong> Easily lost, torn, or forgotten. Impossible to calculate monthly totals on the fly.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold shrink-0">✕</span>
                  <span><strong>Foreign Budget Apps:</strong> Count moving money from Bank to JazzCash as &quot;Expenses&quot;, completely ruining your spending graphs.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold shrink-0">✕</span>
                  <span><strong>Chaotic WhatsApp Udhaar:</strong> &quot;Bhai kitne dene thay?&quot; Awkward disputes with friends and shopkeepers over old repayments.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold shrink-0">✕</span>
                  <span><strong>No Savings Context:</strong> No idea if you saved more or less this month compared to last month.</span>
                </li>
              </ul>
            </Reveal>

            {/* The RAQAMORA Way */}
            <Reveal delay={0.1} className="rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 sm:p-8 shadow-card">
              <div className="flex items-center gap-2.5 text-brand-emerald-deep dark:text-emerald-300">
                <Plus className="size-5 shrink-0" />
                <h3 className="text-base sm:text-lg font-bold">The RAQAMORA OS Way</h3>
              </div>
              <ul className="mt-5 sm:mt-6 space-y-3.5 sm:space-y-4 text-xs sm:text-sm text-ink dark:text-white/90">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-emerald mt-0.5" />
                  <span><strong>Consolidated Multi-Wallet:</strong> Track Cash, Bank, JazzCash &amp; Easypaisa with true transfer logic.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-emerald mt-0.5" />
                  <span><strong>Digital Khata with Timeline:</strong> Clear repayment history, due dates, and printable PDF statements for every person.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-emerald mt-0.5" />
                  <span><strong>Early Warning Budgets:</strong> Amber alerts at 80% threshold before you run out of money mid-month.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-emerald mt-0.5" />
                  <span><strong>Month-over-Month Savings Intelligence:</strong> Live insight showing &quot;You saved +₨ 8,500 more than last month!&quot;</span>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Bento Grid Features */}
      <section id="features" className="scroll-mt-20 bg-slate-100/60 px-4 py-14 sm:px-6 sm:py-20 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-7xl">
          <Reveal className="text-center">
            <Badge variant="outline" className="border-brand-emerald/30 bg-brand-emerald/10 text-xs font-bold text-brand-emerald-deep dark:text-emerald-300">
              Core Capabilities
            </Badge>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink dark:text-white sm:text-3xl lg:text-4xl">
              Engineered for Complete Financial Clarity
            </h2>
            <p className="mx-auto mt-2 sm:mt-3 max-w-2xl text-xs sm:text-sm lg:text-base text-ink-soft">
              Every detail is tuned for Pakistani currency, business habits, and household workflows.
            </p>
          </Reveal>

          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Bento Card 1 - Khata Anchor */}
            <div id="khata" className="scroll-mt-28 h-full">
              <Reveal delay={0.05} className="h-full group rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-raised dark:border-white/10">
                <span className="flex size-10 sm:size-11 items-center justify-center rounded-2xl bg-brand-emerald/15 text-brand-emerald-deep dark:text-emerald-300">
                  <Users className="size-5" />
                </span>
                <h3 className="mt-3.5 sm:mt-4 text-sm sm:text-base font-bold text-ink dark:text-white">Person-wise Digital Khata</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft dark:text-white/60">
                  Track every rupee lent or borrowed. See this month&apos;s activity, repayment installments, due date alerts, and export WhatsApp statements.
                </p>
              </Reveal>
            </div>

            {/* Bento Card 2 */}
            <Reveal delay={0.1} className="h-full group rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-raised dark:border-white/10">
              <span className="flex size-10 sm:size-11 items-center justify-center rounded-2xl bg-gold/15 text-gold-deep dark:text-amber-400">
                <Target className="size-5" />
              </span>
              <h3 className="mt-3.5 sm:mt-4 text-sm sm:text-base font-bold text-ink dark:text-white">Smart Category Budgets</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft dark:text-white/60">
                Set monthly limits for Food, Clothes, Fuel and Bills. Color-coded warning bars alert you at your chosen threshold before you overspend.
              </p>
            </Reveal>

            {/* Bento Card 3 */}
            <Reveal delay={0.15} className="h-full group rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-raised dark:border-white/10">
              <span className="flex size-10 sm:size-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <ArrowLeftRight className="size-5" />
              </span>
              <h3 className="mt-3.5 sm:mt-4 text-sm sm:text-base font-bold text-ink dark:text-white">Multi-Wallet Reconciliation</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft dark:text-white/60">
                Cash, Meezan, HBL, JazzCash, Easypaisa, Raast. Direct balance edit &amp; reconciliation transactions keep every rupee accountable.
              </p>
            </Reveal>

            {/* Bento Card 4 */}
            <Reveal delay={0.2} className="h-full group rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-raised dark:border-white/10">
              <span className="flex size-10 sm:size-11 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <TrendingUp className="size-5" />
              </span>
              <h3 className="mt-3.5 sm:mt-4 text-sm sm:text-base font-bold text-ink dark:text-white">Savings Intelligence</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft dark:text-white/60">
                Instantly see if you saved more than last month. Net savings trends, 6-month cashflow charts, and category expenditure breakdowns.
              </p>
            </Reveal>

            {/* Bento Card 5 */}
            <Reveal delay={0.25} className="h-full group rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-raised dark:border-white/10">
              <span className="flex size-10 sm:size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Sigma className="size-5" />
              </span>
              <h3 className="mt-3.5 sm:mt-4 text-sm sm:text-base font-bold text-ink dark:text-white">Integer Paisa Precision</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft dark:text-white/60">
                1 PKR = 100 paisa stored as exact integers. Zero binary IEEE-754 floating point rounding errors that plague foreign budgeting software.
              </p>
            </Reveal>

            {/* Bento Card 6 */}
            <Reveal delay={0.3} className="h-full group rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-raised dark:border-white/10">
              <span className="flex size-10 sm:size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Clock3 className="size-5" />
              </span>
              <h3 className="mt-3.5 sm:mt-4 text-sm sm:text-base font-bold text-ink dark:text-white">Karachi Timezone Locked</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft dark:text-white/60">
                Never have 1st-of-the-month salary transactions register under the previous month due to UTC time shifts. Designed for Asia/Karachi PKT.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Interactive Savings Calculator */}
      <section id="calculator" className="scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <SavingsCalculatorWidget />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------- Testimonials */}
      <section className="bg-slate-100/60 px-4 py-14 sm:px-6 sm:py-20 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-7xl">
          <Reveal className="text-center">
            <Badge variant="outline" className="border-brand-emerald/30 bg-brand-emerald/10 text-xs font-bold text-brand-emerald-deep dark:text-emerald-300">
              Community Trust
            </Badge>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink dark:text-white sm:text-3xl lg:text-4xl">
              Loved by Freelancers, Families &amp; Businesses in Pakistan
            </h2>
          </Reveal>

          <div className="mt-8 sm:mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
            <Reveal delay={0.05} className="rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card dark:border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex text-amber-500 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-ink-soft dark:text-white/70">
                  &quot;As a freelance software engineer in Lahore receiving foreign remittances into Meezan, and withdrawing to JazzCash &amp; Cash, normal apps made a mess of transfers. RAQAMORA handles multi-wallets flawlessly.&quot;
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-hairline/60 pt-4 dark:border-white/10">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-emerald/20 text-xs font-bold text-brand-emerald-deep dark:text-emerald-300">
                  HT
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink dark:text-white truncate">Hamza Tariq</div>
                  <div className="text-[10px] text-ink-soft truncate">Freelance Developer · Lahore</div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card dark:border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex text-amber-500 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-ink-soft dark:text-white/70">
                  &quot;The monthly budget warning threshold is a lifesaver. When our grocery expenditure reached 80%, we got an amber alert and managed to save ₨ 24,000 in November alone!&quot;
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-hairline/60 pt-4 dark:border-white/10">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold-deep dark:text-amber-400">
                  AS
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink dark:text-white truncate">Dr. Ayesha Siddiqui</div>
                  <div className="text-[10px] text-ink-soft truncate">Medical Professional · Karachi</div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15} className="rounded-2xl sm:rounded-3xl border border-hairline/80 bg-card p-5 sm:p-6 shadow-card dark:border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex text-amber-500 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-ink-soft dark:text-white/70">
                  &quot;The Khata ledger with printable statements replaced my shop&apos;s physical paper register. Customers trust me more when I send them a clear statement showing every repayment.&quot;
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-hairline/60 pt-4 dark:border-white/10">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400">
                  MB
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink dark:text-white truncate">Muhammad Bilal</div>
                  <div className="text-[10px] text-ink-soft truncate">Business Owner · Rawalpindi</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- FAQ Section (AEO & SEO) */}
      <section id="faq" className="scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal className="text-center">
            <Badge variant="outline" className="border-gold/40 bg-gold/10 text-xs font-bold text-gold-deep">
              AEO &amp; Search FAQ
            </Badge>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink dark:text-white sm:text-3xl lg:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-2 text-xs sm:text-sm text-ink-soft">
              Sab kuch jo aapko RAQAMORA ke baare mein janne ki zaroorat hai.
            </p>
          </Reveal>

          <div className="mt-8 sm:mt-10 space-y-2.5 sm:space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 0.04}>
                <FaqItem q={faq.q} a={faq.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Final Conversion CTA */}
      <section className="overflow-hidden px-4 pb-14 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0b1320] via-[#101c2c] to-[#080d17] p-6 sm:p-10 md:p-16 text-center text-white shadow-raised border border-white/10">
            <div className="pointer-events-none absolute -left-10 -top-10 size-56 rounded-full bg-brand-emerald/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 -bottom-10 size-56 rounded-full bg-gold/15 blur-3xl" />

            <div className="relative z-10 mx-auto max-w-2xl space-y-4 sm:space-y-5">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-bold">
                100% Free Forever
              </Badge>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
                Apne Paise Par Mukammal Control Hasil Karein.
              </h2>
              <p className="text-xs sm:text-sm md:text-base leading-relaxed text-white/70">
                Join thousands of Pakistanis who track every rupee, master their monthly budget, and eliminate khata confusion with RAQAMORA.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-3 sm:pt-4">
                <Button
                  size="lg"
                  className="w-full sm:w-auto min-h-12 justify-center rounded-xl bg-gradient-to-r from-brand-emerald-deep to-brand-emerald px-6 sm:px-8 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-105 active:scale-95 transition-all"
                  onClick={() => onSignIn("signup")}
                >
                  Start Tracking Free Now
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                <DemoButton
                  size="lg"
                  variant="outline"
                  label="Try Live Demo"
                  className="w-full sm:w-auto min-h-12 justify-center rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 text-sm font-semibold"
                  onDemo={onEnterApp}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Comprehensive Footer */}
      <footer className="border-t border-hairline/80 bg-white/40 py-10 sm:py-14 dark:border-white/10 dark:bg-card/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-2">
              <RaqamoraWordmark size="md" />
              <p className="max-w-sm text-xs leading-relaxed text-ink-soft dark:text-white/60">
                RAQAMORA is Pakistan&apos;s premier personal financial operating system. Engineered with integer paisa precision, multi-wallet sync, person-wise digital khata, and offline PWA capability.
              </p>
              <div className="text-[11px] font-semibold text-brand-emerald">
                🇵🇰 Proudly built for Pakistan · Asia/Karachi (PKT)
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold uppercase tracking-wider text-ink dark:text-white">Product</p>
              <ul className="space-y-1.5 text-ink-soft dark:text-white/60">
                <li><a href="#features" className="hover:text-ink dark:hover:text-white transition-colors">Multi-Wallet Sync</a></li>
                <li><a href="#khata" className="hover:text-ink dark:hover:text-white transition-colors">Digital Khata</a></li>
                <li><a href="#calculator" className="hover:text-ink dark:hover:text-white transition-colors">Monthly Budgets</a></li>
                <li><a href="#calculator" className="hover:text-ink dark:hover:text-white transition-colors">Savings Calculator</a></li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold uppercase tracking-wider text-ink dark:text-white">Security &amp; Tech</p>
              <ul className="space-y-1.5 text-ink-soft dark:text-white/60">
                <li><span>Integer Paisa Math</span></li>
                <li><span>256-Bit Encryption</span></li>
                <li><span>Offline First PWA</span></li>
                <li><span>Zero Tracker Cookies</span></li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold uppercase tracking-wider text-ink dark:text-white">Local Ecosystem</p>
              <ul className="space-y-1.5 text-ink-soft dark:text-white/60">
                <li><span>Pakistani Rupee (PKR)</span></li>
                <li><span>JazzCash &amp; Easypaisa</span></li>
                <li><span>Meezan, HBL, Bank Alfalah</span></li>
                <li><span>Raast P2P Ready</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 sm:mt-12 flex flex-col items-center justify-between gap-3 border-t border-hairline/60 pt-6 text-[11px] text-ink-soft dark:border-white/10 dark:text-white/50 sm:flex-row text-center sm:text-left">
            <p>&copy; {new Date().getFullYear()} RAQAMORA. All rights reserved.</p>
            <p>Financial figures rendered in Pakistani Rupee (PKR) with integer paisa precision.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
