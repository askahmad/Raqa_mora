"use client";

/**
 * RAQAMORA landing — premium fintech marketing page on warm ivory.
 * Pure CSS/SVG mock visuals; no images, no rainbow gradients.
 */
import * as React from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Clock3,
  CloudOff,
  HandCoins,
  PiggyBank,
  Repeat,
  Sigma,
  Smartphone,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import type { SessionUser } from "@/lib/raqamora/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoButton, Money } from "@/components/raqamora/kit";
import { RaqamoraWordmark } from "@/components/raqamora/brand";
import { LanguageSwitcher } from "@/components/raqamora/language-switcher";

export interface LandingProps {
  onEnterApp: (user: SessionUser) => void;
  onSignIn: (mode: "login" | "signup") => void;
}

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
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: 0.45, delay, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------- Hero mock card */

function Sparkline() {
  return (
    <svg viewBox="0 0 120 36" className="h-9 w-full" aria-hidden preserveAspectRatio="none">
      <path
        d="M0 30 L15 26 L30 28 L45 20 L60 22 L75 14 L90 17 L105 9 L120 12 L120 36 L0 36 Z"
        fill="#16836F"
        opacity="0.08"
      />
      <polyline
        points="0,30 15,26 30,28 45,20 60,22 75,14 90,17 105,9 120,12"
        fill="none"
        stroke="#16836F"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-hairline bg-white p-5 shadow-raised">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">
            Total balance
          </span>
          <Badge variant="outline" className="border-brand-emerald/25 bg-brand-emerald/10 px-1.5 text-[10px] text-brand-emerald-deep">
            This month
          </Badge>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <Money value={8_432_050} size="xl" />
          <Badge variant="outline" className="border-brand-emerald/25 bg-brand-emerald/10 text-[10px] text-brand-emerald-deep">
            +2.4%
          </Badge>
        </div>
        <div className="mt-3">
          <Sparkline />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-hairline bg-ivory p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">Income</p>
            <Money value={14_200_000} size="sm" className="mt-0.5 block text-money-pos" />
          </div>
          <div className="rounded-lg border border-hairline bg-ivory p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">Spent</p>
            <Money value={5_868_000} size="sm" className="mt-0.5 block" />
          </div>
        </div>
        {/* person-wise ledger chip */}
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-hairline bg-ivory p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold-deep">
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">Ali</p>
            <p className="text-[11px] text-ink-soft">owes you · due Friday</p>
          </div>
          <Money value={600_000} size="sm" colored className="text-money-pos" />
        </div>
      </div>
      {/* floating budget chip */}
      <div className="absolute -bottom-5 -right-2 rounded-xl border border-hairline bg-white px-3 py-2 shadow-raised sm:-right-6">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-warn-brand/15 text-warn-brand">
            <Target className="size-3" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-medium text-ink">Budget · Groceries</p>
            <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[72%] rounded-full bg-brand-emerald" />
            </div>
          </div>
          <span className="text-[10px] font-semibold text-ink-soft">72%</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Data */

const TRUST: Array<{ icon: LucideIcon; label: string }> = [
  { icon: BadgeCheck, label: "PKR-native" },
  { icon: Clock3, label: "Karachi timezone" },
  { icon: Sigma, label: "Exact paisa arithmetic" },
  { icon: CloudOff, label: "Works offline-friendly" },
];

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: ArrowLeftRight,
    title: "Transaction clarity",
    body: "Transfers between your own accounts never inflate spending — your picture stays honest.",
  },
  {
    icon: Users,
    title: "Person-wise ledgers",
    body: "Every lend and borrowing is tracked per person, with repayments settled to the rupee.",
  },
  {
    icon: Target,
    title: "Budgets that warn early",
    body: "Set monthly category limits and get warned before you cross your own threshold.",
  },
  {
    icon: PiggyBank,
    title: "Savings goals",
    body: "Name the target — Eid gifts, a laptop, emergency fund — and track contributions over time.",
  },
  {
    icon: Repeat,
    title: "Recurring bills",
    body: "Rent, internet, subscriptions: schedule them once and RAQAMORA posts them on time.",
  },
  {
    icon: BarChart3,
    title: "Reports & CSV export",
    body: "Monthly trends, category breakdowns and one-click CSV for your accountant.",
  },
];

const WHY: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Smartphone,
    title: "Built for Pakistan",
    body: "Cash, bank, Easypaisa and JazzCash are first-class account types — not an afterthought.",
  },
  {
    icon: ArrowLeftRight,
    title: "Transfers are not spending",
    body: "Moving money between your own wallets never shows up as an expense. Ever.",
  },
  {
    icon: HandCoins,
    title: "Ledgers you can trust",
    body: "Integer paisa arithmetic and person-wise ledgers keep every rupee accountable.",
  },
];

/* ---------------------------------------------------------------- Landing */

export function Landing({ onEnterApp, onSignIn }: LandingProps) {
  return (
    <div className="min-h-dvh bg-ivory text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-ivory/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <RaqamoraWordmark size="sm" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" className="min-h-9" onClick={() => onSignIn("login")}>
              Sign in
            </Button>
            <Button size="sm" className="min-h-9" onClick={() => onSignIn("signup")}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 md:pb-28 md:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Badge variant="outline" className="border-gold/40 bg-gold/10 text-[11px] font-medium text-gold-deep">
              Made for Pakistan
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-navy md:text-5xl">
              Your Money. One Clear&nbsp;Picture.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Track income, expenses, lends &amp; borrowings across Cash, Bank, Easypaisa &amp;
              JazzCash — with person-wise ledgers, early budget warnings and paisa-perfect
              arithmetic.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button size="lg" className="min-h-11" onClick={() => onSignIn("signup")}>
                Create free account
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button size="lg" variant="outline" className="min-h-11 border-hairline bg-white" onClick={() => onSignIn("login")}>
                Sign in
              </Button>
              <DemoButton size="lg" variant="secondary" className="min-h-11 bg-secondary/70" onDemo={onEnterApp} />
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Free · No card required · Your data stays yours
            </p>
          </Reveal>
          <Reveal delay={0.12} className="pb-6 lg:pb-0">
            <HeroMock />
          </Reveal>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-hairline bg-white/60">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 px-4 py-4 md:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <t.icon className="size-4 shrink-0 text-brand-emerald" aria-hidden />
              <span className="text-xs font-medium text-ink">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-deep">Features</p>
          <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-navy md:text-3xl">
            Everything your money does, in one calm place
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="h-full rounded-xl border border-hairline bg-card p-5 shadow-card">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-emerald/10 text-brand-emerald">
                  <f.icon className="size-4" aria-hidden />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Why band */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:pb-24">
        <Reveal>
          <div className="rounded-3xl border border-white/5 bg-navy px-6 py-10 text-ivory md:px-12 md:py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Why RAQAMORA</p>
            <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight md:text-3xl">
              Money tools that speak your language
            </h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {WHY.map((w) => (
                <div key={w.title}>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-gold/15 text-gold">
                    <w.icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{w.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ivory/65">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 text-center">
          <RaqamoraWordmark size="sm" />
          <p className="text-xs text-ink-soft">Your Money. One Clear Picture.</p>
          <p className="text-[11px] text-ink-soft/70">© {new Date().getFullYear()} RAQAMORA</p>
        </div>
      </footer>
    </div>
  );
}
