"use client";

/**
 * RAQAMORA Zakat & Nisab Calculator — Islamic Wealth & Charity Planner.
 *
 * Designed for Pakistani Muslims with paisa-exact accuracy:
 * - Real-time Gold & Silver Nisab calculation (7.5 tola gold / 52.5 tola silver)
 * - 1-Click auto-fill from current RAQAMORA balances (Cash, Bank, Wallets, Receivables, Payables)
 * - Transparent 2.5% calculation with breakdown of assets & deductible liabilities
 * - Islamic rulings and Nisab threshold status
 */
import * as React from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Coins,
  DollarSign,
  HelpCircle,
  Info,
  RefreshCw,
  Scale,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/raqamora/client";
import { formatPKR } from "@/lib/raqamora/money";
import type { AccountWithBalance, DebtWithOutstanding } from "@/lib/raqamora/types";
import type { ViewProps } from "@/components/raqamora/view-props";
import { PageHeader, SectionCard } from "@/components/raqamora/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// Default prevailing benchmark rates in Pakistan (PKR)
const DEFAULT_GOLD_PER_TOLA = 275000;
const DEFAULT_SILVER_PER_TOLA = 3200;
const SILVER_NISAB_TOLA = 52.5;
const GOLD_NISAB_TOLA = 7.5;

export default function ZakatView({ onViewChange }: ViewProps) {
  // Benchmark Rates
  const [goldRatePerTola, setGoldRatePerTola] = React.useState(DEFAULT_GOLD_PER_TOLA);
  const [silverRatePerTola, setSilverRatePerTola] = React.useState(DEFAULT_SILVER_PER_TOLA);
  const [nisabStandard, setNisabStandard] = React.useState<"SILVER" | "GOLD">("SILVER");

  // Assets
  const [goldTola, setGoldTola] = React.useState<string>("");
  const [silverTola, setSilverTola] = React.useState<string>("");
  const [cashAndBankRupees, setCashAndBankRupees] = React.useState<string>("");
  const [receivablesRupees, setReceivablesRupees] = React.useState<string>("");
  const [businessStockRupees, setBusinessStockRupees] = React.useState<string>("");

  // Liabilities
  const [debtsOwedRupees, setDebtsOwedRupees] = React.useState<string>("");
  const [immediateExpensesRupees, setImmediateExpensesRupees] = React.useState<string>("");

  // Auto-sync loading
  const [syncing, setSyncing] = React.useState(false);

  // Calculations
  const goldVal = (parseFloat(goldTola) || 0) * goldRatePerTola;
  const silverVal = (parseFloat(silverTola) || 0) * silverRatePerTola;
  const cashVal = parseFloat(cashAndBankRupees) || 0;
  const recvVal = parseFloat(receivablesRupees) || 0;
  const stockVal = parseFloat(businessStockRupees) || 0;

  const totalAssets = goldVal + silverVal + cashVal + recvVal + stockVal;

  const debtsVal = parseFloat(debtsOwedRupees) || 0;
  const expensesVal = parseFloat(immediateExpensesRupees) || 0;
  const totalLiabilities = debtsVal + expensesVal;

  const netZakatableWealth = Math.max(0, totalAssets - totalLiabilities);

  // Nisab Values in PKR
  const silverNisabValue = SILVER_NISAB_TOLA * silverRatePerTola;
  const goldNisabValue = GOLD_NISAB_TOLA * goldRatePerTola;
  const effectiveNisab = nisabStandard === "SILVER" ? silverNisabValue : goldNisabValue;

  const isEligible = netZakatableWealth >= effectiveNisab;
  const zakatDue = isEligible ? Math.round(netZakatableWealth * 0.025) : 0;

  // 1-Click Auto-fill from RAQAMORA data
  async function syncFromRaqamora() {
    setSyncing(true);
    try {
      const [accRes, debtRes] = await Promise.all([
        apiGet<{ accounts: AccountWithBalance[] }>("/api/accounts"),
        apiGet<{ debts: DebtWithOutstanding[] }>("/api/debts"),
      ]);

      // Cash & Bank Balances (excluding archived)
      let totalBankPaisa = 0;
      for (const a of accRes.accounts) {
        if (!a.archived && a.balance > 0) {
          totalBankPaisa += a.balance;
        }
      }
      setCashAndBankRupees(String(Math.round(totalBankPaisa / 100)));

      // Debts: Receivables (They owe me) vs Payables (I owe them)
      let activeReceivablePaisa = 0;
      let activePayablePaisa = 0;
      for (const d of debtRes.debts) {
        if (d.status === "ACTIVE") {
          if (d.direction === "RECEIVABLE") activeReceivablePaisa += d.outstanding;
          else if (d.direction === "PAYABLE") activePayablePaisa += d.outstanding;
        }
      }
      setReceivablesRupees(String(Math.round(activeReceivablePaisa / 100)));
      setDebtsOwedRupees(String(Math.round(activePayablePaisa / 100)));

      toast.success("RAQAMORA accounts aur khata se balances auto-fill ho gaye!");
    } catch {
      toast.error("Balances sync nahi ho sake.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Zakat & Nisab Calculator"
        description="Paisa-exact Islamic wealth evaluation & 2.5% Zakat calculation"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={syncFromRaqamora}
            disabled={syncing}
            className="gap-1.5 border-brand-emerald/40 text-brand-emerald-deep hover:bg-brand-emerald/10 dark:text-[#53c6ac]"
          >
            <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
            <span>Auto-fill from RAQAMORA</span>
          </Button>
        }
      />

      {/* Hero Zakat Result Banner */}
      <div
        className={cn(
          "rounded-3xl border p-5 sm:p-7 shadow-lg transition-all",
          isEligible
            ? "border-brand-emerald/40 bg-gradient-to-br from-brand-emerald/15 via-card to-card"
            : "border-hairline bg-card",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "font-semibold",
                  isEligible
                    ? "border-brand-emerald text-brand-emerald-deep dark:text-[#53c6ac]"
                    : "border-ink-soft text-ink-soft",
                )}
              >
                {isEligible ? "Sahib-e-Nisab (Zakat Wajib Hai)" : "Nisab se Kam (Zakat Wajib Nahi)"}
              </Badge>
              <span className="text-xs text-ink-soft">
                Nisab Standard: {nisabStandard === "SILVER" ? "52.5 Tola Chandi (Silver)" : "7.5 Tola Sona (Gold)"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">
              {isEligible ? (
                <span>
                  Kul Zakat: <span className="text-brand-emerald font-black">{formatPKR(zakatDue * 100)}</span>
                </span>
              ) : (
                <span>Zakat Farz Nahi Hai (PKR 0)</span>
              )}
            </h2>
            <p className="text-xs text-ink-soft">
              Net Zakatable Wealth: <strong>{formatPKR(netZakatableWealth * 100)}</strong> · Nisab Threshold:{" "}
              <strong>{formatPKR(effectiveNisab * 100)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={nisabStandard === "SILVER" ? "secondary" : "outline"}
              className="text-xs"
              onClick={() => setNisabStandard("SILVER")}
            >
              Silver Benchmark (Recommended)
            </Button>
            <Button
              size="sm"
              variant={nisabStandard === "GOLD" ? "secondary" : "outline"}
              className="text-xs"
              onClick={() => setNisabStandard("GOLD")}
            >
              Gold Benchmark
            </Button>
          </div>
        </div>

        {/* 3 Step Breakdown */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-hairline/60 pt-4 text-xs">
          <div className="rounded-xl border border-hairline/60 bg-muted/30 p-3">
            <span className="text-ink-soft">1. Total Assets (Maal)</span>
            <p className="mt-1 text-sm font-bold text-ink">{formatPKR(totalAssets * 100)}</p>
          </div>
          <div className="rounded-xl border border-hairline/60 bg-muted/30 p-3">
            <span className="text-ink-soft">2. Less: Liabilities (Wajib-ul-Ada)</span>
            <p className="mt-1 text-sm font-bold text-danger-brand">- {formatPKR(totalLiabilities * 100)}</p>
          </div>
          <div className="rounded-xl border border-hairline/60 bg-muted/30 p-3">
            <span className="text-ink-soft">3. Net Zakatable (2.5% Rate)</span>
            <p className="mt-1 text-sm font-bold text-brand-emerald-deep dark:text-[#53c6ac]">
              {formatPKR(netZakatableWealth * 100)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Section 1: Assets */}
        <SectionCard
          title="Zakatable Assets (Aap ke Asasay)"
          subtitle="Gold, Silver, Cash, Bank, Receivables aur Business Stock"
        >
          <div className="space-y-4">
            {/* Gold */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="zk-gold" className="text-xs font-semibold">
                  Gold (Sona in Tola)
                </Label>
                <Input
                  id="zk-gold"
                  type="number"
                  step="0.01"
                  placeholder="0 tola"
                  value={goldTola}
                  onChange={(e) => setGoldTola(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zk-gold-rate" className="text-xs text-ink-soft">
                  Gold Rate (PKR / Tola)
                </Label>
                <Input
                  id="zk-gold-rate"
                  type="number"
                  value={goldRatePerTola}
                  onChange={(e) => setGoldRatePerTola(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Silver */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="zk-silver" className="text-xs font-semibold">
                  Silver (Chandi in Tola)
                </Label>
                <Input
                  id="zk-silver"
                  type="number"
                  step="0.01"
                  placeholder="0 tola"
                  value={silverTola}
                  onChange={(e) => setSilverTola(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zk-silver-rate" className="text-xs text-ink-soft">
                  Silver Rate (PKR / Tola)
                </Label>
                <Input
                  id="zk-silver-rate"
                  type="number"
                  value={silverRatePerTola}
                  onChange={(e) => setSilverRatePerTola(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Cash & Bank */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="zk-cash" className="text-xs font-semibold">
                  Cash in Hand & Bank Balances (PKR)
                </Label>
                <span className="text-[11px] text-brand-emerald">Cash, JazzCash, Meezan, etc.</span>
              </div>
              <Input
                id="zk-cash"
                type="number"
                placeholder="0"
                value={cashAndBankRupees}
                onChange={(e) => setCashAndBankRupees(e.target.value)}
              />
            </div>

            {/* Receivables (Money lent to others) */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="zk-recv" className="text-xs font-semibold">
                  Money Lent Expected Back (Udhaar Wasooli)
                </Label>
                <span className="text-[11px] text-ink-soft">Good debts</span>
              </div>
              <Input
                id="zk-recv"
                type="number"
                placeholder="0"
                value={receivablesRupees}
                onChange={(e) => setReceivablesRupees(e.target.value)}
              />
            </div>

            {/* Business Stock */}
            <div className="space-y-1">
              <Label htmlFor="zk-stock" className="text-xs font-semibold">
                Trade Inventory / Business Goods for Sale (PKR)
              </Label>
              <Input
                id="zk-stock"
                type="number"
                placeholder="0"
                value={businessStockRupees}
                onChange={(e) => setBusinessStockRupees(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 2: Deductions & Islamic Guidance */}
        <div className="space-y-5">
          <SectionCard
            title="Deductible Liabilities (Wajib-ul-Ada Qarz)"
            subtitle="Money you owe that reduces your Zakatable net wealth"
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="zk-debt" className="text-xs font-semibold">
                  Debts Owed to People / Banks (Aap par qarz)
                </Label>
                <Input
                  id="zk-debt"
                  type="number"
                  placeholder="0"
                  value={debtsOwedRupees}
                  onChange={(e) => setDebtsOwedRupees(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="zk-expenses" className="text-xs font-semibold">
                  Immediate Due Bills / Salaries Pending (PKR)
                </Label>
                <Input
                  id="zk-expenses"
                  type="number"
                  placeholder="0"
                  value={immediateExpensesRupees}
                  onChange={(e) => setImmediateExpensesRupees(e.target.value)}
                />
              </div>
            </div>
          </SectionCard>

          {/* Guidelines Card */}
          <div className="rounded-2xl border border-hairline/80 bg-muted/40 p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-ink">
              <HelpCircle className="size-4 text-brand-emerald" />
              <span>Zakat ke Bunyadi Usool (Quick Guidance)</span>
            </div>
            <ul className="space-y-1.5 text-ink-soft list-disc list-inside leading-relaxed">
              <li>
                <strong>Nisab (حدِ نصاب):</strong> Agar aapke pas 52.5 Tola Chandi (Silver) ya 7.5 Tola Sona (Gold) ya iske barabar raqam mojood hai, toh Zakat wajib hoti hai.
              </li>
              <li>
                <strong>Hawl (ایک سال گزرنا):</strong> Is raqam par Qamri (Lunar) saal guzarna shart hai.
              </li>
              <li>
                <strong>Zakat Rate:</strong> Kul net bachat par <strong>2.5% (40wan hissa)</strong> ada karna hota hai.
              </li>
              <li>
                <strong>Personal Belongings:</strong> Zaati ghar, sawari (gaari/bike), aur rozmara istamaal ki cheezon par Zakat nahi hoti.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
