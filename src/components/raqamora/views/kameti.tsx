"use client";

/**
 * RAQAMORA Kameti (Committee / Chit Fund) Tracker
 *
 * Dedicated Pakistani peer-saving & rotating credit tracker:
 * - Tracks monthly installment, total pool, total months/members
 * - Visual turn indicator ("Aapki bari Month X mein hai")
 * - Month-by-month payment tracking with 1-click status update
 * - Offline-first persistent storage with seamless UX
 */
import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Ellipsis,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatPKR, parseRupeesToPaisa } from "@/lib/raqamora/money";
import type { ViewProps } from "@/components/raqamora/view-props";
import { EmptyState, PageHeader, SectionCard } from "@/components/raqamora/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface KametiItem {
  id: string;
  name: string;
  monthlyAmountRupees: number;
  totalMonths: number;
  startMonth: string; // YYYY-MM
  myTurnMonth: number; // 1 to totalMonths
  payoutCollected: boolean;
  notes?: string;
  paidMonths: number[]; // e.g. [1, 2, 3]
  createdAt: string;
}

const STORAGE_KEY = "raqamora_kametis_v1";

function loadKametis(): KametiItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KametiItem[]) : [];
  } catch {
    return [];
  }
}

function saveKametis(items: KametiItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore storage quotas */
  }
}

export default function KametiView({ onViewChange }: ViewProps) {
  const [kametis, setKametis] = React.useState<KametiItem[]>(() => loadKametis());
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Form State
  const [name, setName] = React.useState("");
  const [monthlyAmount, setMonthlyAmount] = React.useState("");
  const [totalMonths, setTotalMonths] = React.useState("10");
  const [myTurn, setMyTurn] = React.useState("3");
  const [startMonth, setStartMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = React.useState("");

  const updateList = React.useCallback((items: KametiItem[]) => {
    setKametis(items);
    saveKametis(items);
  }, []);

  function handleCreateKameti(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(monthlyAmount);
    const months = parseInt(totalMonths, 10);
    const turn = parseInt(myTurn, 10);

    if (!name.trim() || isNaN(amount) || amount <= 0 || isNaN(months) || months <= 0) {
      toast.error("Tamam zaroori maloomat darust tareeqe se enter karein.");
      return;
    }

    const newItem: KametiItem = {
      id: `kameti_${Date.now()}`,
      name: name.trim(),
      monthlyAmountRupees: amount,
      totalMonths: months,
      startMonth: startMonth || new Date().toISOString().slice(0, 7),
      myTurnMonth: isNaN(turn) ? 1 : Math.min(turn, months),
      payoutCollected: false,
      notes: notes.trim() || undefined,
      paidMonths: [],
      createdAt: new Date().toISOString(),
    };

    const next = [newItem, ...kametis];
    updateList(next);
    toast.success(`Kameti "${newItem.name}" kamyabi se add ho gayi!`);
    setDialogOpen(false);

    // Reset Form
    setName("");
    setMonthlyAmount("");
    setNotes("");
  }

  function toggleMonthPayment(kametiId: string, monthIdx: number) {
    const updated = kametis.map((k) => {
      if (k.id !== kametiId) return k;
      const alreadyPaid = k.paidMonths.includes(monthIdx);
      const nextPaid = alreadyPaid ? k.paidMonths.filter((m) => m !== monthIdx) : [...k.paidMonths, monthIdx];
      return { ...k, paidMonths: nextPaid };
    });
    updateList(updated);
  }

  function togglePayoutCollected(kametiId: string) {
    const updated = kametis.map((k) => {
      if (k.id !== kametiId) return k;
      const nextVal = !k.payoutCollected;
      toast.success(nextVal ? "Mubarak ho! Kameti wasool ho gayi." : "Payout status updated.");
      return { ...k, payoutCollected: nextVal };
    });
    updateList(updated);
  }

  function deleteKameti(id: string) {
    const updated = kametis.filter((k) => k.id !== id);
    updateList(updated);
    toast.success("Kameti delete kar di gayi.");
  }

  // Summary Metrics
  const totalActive = kametis.length;
  let totalMonthlyCommitment = 0;
  let totalPoolExpected = 0;
  for (const k of kametis) {
    totalMonthlyCommitment += k.monthlyAmountRupees;
    totalPoolExpected += k.monthlyAmountRupees * k.totalMonths;
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Kameti (Committee) Tracker"
        description="Pakistan's favorite informal peer-saving & rotating credit tracker"
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            <span>Nayi Kameti Add Karein</span>
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-hairline bg-card p-4 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Active Kametis</p>
          <p className="mt-1 text-2xl font-bold text-ink">{totalActive}</p>
          <p className="text-xs text-ink-soft">Chalti hui committees</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-card p-4 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Mahana Qist (Monthly)</p>
          <p className="mt-1 text-2xl font-bold text-danger-brand">{formatPKR(totalMonthlyCommitment * 100)}</p>
          <p className="text-xs text-ink-soft">Har mahine ada karne wali kul raqam</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-card p-4 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Kul Wasooli (Total Pool)</p>
          <p className="mt-1 text-2xl font-bold text-brand-emerald-deep dark:text-[#53c6ac]">
            {formatPKR(totalPoolExpected * 100)}
          </p>
          <p className="text-xs text-ink-soft">Aapki bari par milne wali kul raqam</p>
        </div>
      </div>

      {/* List */}
      {kametis.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="Abhi koi Kameti add nahi ki gayi"
          description="Doston, office ya family ke sath chalti hui kameti yahan record karein taake har mahine ki qist aur aapki bari ka hisab rahe."
          actionLabel="Pehli Kameti Add Karein"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {kametis.map((k) => {
            const poolRupees = k.monthlyAmountRupees * k.totalMonths;
            const paidCount = k.paidMonths.length;
            const progressPct = Math.round((paidCount / k.totalMonths) * 100);

            return (
              <div
                key={k.id}
                className="rounded-2xl border border-hairline/80 bg-card p-4 sm:p-5 shadow-card space-y-4 transition-all"
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-ink">{k.name}</h3>
                      <Badge variant="outline" className="text-[10px] font-semibold border-brand-emerald text-brand-emerald">
                        {k.totalMonths} Mahine / Members
                      </Badge>
                      {k.payoutCollected ? (
                        <Badge variant="secondary" className="text-[10px] bg-brand-emerald/15 text-brand-emerald-deep dark:text-[#53c6ac]">
                          <CheckCircle2 className="size-3 mr-1" /> Wasool Shuda
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-ink-soft">
                      Mahana Qist: <strong>{formatPKR(k.monthlyAmountRupees * 100)}</strong> · Kul Wasooli Pool:{" "}
                      <strong>{formatPKR(poolRupees * 100)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={k.payoutCollected ? "outline" : "secondary"}
                      className="text-xs h-8"
                      onClick={() => togglePayoutCollected(k.id)}
                    >
                      {k.payoutCollected ? "Payout Mark Uncollected" : "Mark Payout Collected"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <Ellipsis className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => deleteKameti(k.id)} className="text-danger-brand">
                          <Trash2 className="size-3.5 mr-1" /> Delete Kameti
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Turn Highlight Card */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-emerald/30 bg-brand-emerald/10 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-brand-emerald" />
                    <span>
                      Aapki bari <strong>Month {k.myTurnMonth}</strong> mein hai (Total Payout:{" "}
                      <strong>{formatPKR(poolRupees * 100)}</strong>)
                    </span>
                  </div>
                  <div className="text-ink-soft font-medium">
                    {paidCount} of {k.totalMonths} Qistein Ada ({progressPct}%)
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand-emerald rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Monthly Installment Grid */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                    Mahana Qist Status (Click to Toggle Paid):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: k.totalMonths }, (_, i) => i + 1).map((monthNum) => {
                      const isPaid = k.paidMonths.includes(monthNum);
                      const isMyTurn = monthNum === k.myTurnMonth;

                      return (
                        <button
                          key={monthNum}
                          type="button"
                          onClick={() => toggleMonthPayment(k.id, monthNum)}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 border",
                            isPaid
                              ? "bg-brand-emerald text-white border-brand-emerald shadow-2xs"
                              : "bg-muted/40 text-ink-soft border-hairline hover:border-ink-soft",
                            isMyTurn && "ring-2 ring-warn-brand",
                          )}
                          title={`Month ${monthNum}: ${isPaid ? "Paid" : "Pending"}${isMyTurn ? " (Aapki Bari!)" : ""}`}
                        >
                          {isPaid ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                          <span>M{monthNum}</span>
                          {isMyTurn ? <span className="text-[9px] font-bold text-amber-300">★</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {k.notes ? <p className="text-xs text-ink-soft italic bg-muted/20 p-2 rounded-lg">{k.notes}</p> : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Kameti Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="size-5 text-brand-emerald" />
              Nayi Kameti Add Karein
            </DialogTitle>
            <DialogDescription>
              Mahana bachat committee details darj karein taake har mahine ki qist track ho sake.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateKameti} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label htmlFor="km-name" className="text-xs font-semibold">
                Kameti ka Naam
              </Label>
              <Input
                id="km-name"
                placeholder="e.g. Office Monthly Kameti ya Family Bachat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="km-amount" className="text-xs font-semibold">
                  Mahana Qist (PKR)
                </Label>
                <Input
                  id="km-amount"
                  type="number"
                  placeholder="e.g. 10000"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="km-months" className="text-xs font-semibold">
                  Kul Mahine / Members
                </Label>
                <Input
                  id="km-months"
                  type="number"
                  min="2"
                  max="50"
                  value={totalMonths}
                  onChange={(e) => setTotalMonths(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="km-turn" className="text-xs font-semibold">
                  Aapki Bari (Month No.)
                </Label>
                <Input
                  id="km-turn"
                  type="number"
                  min="1"
                  max={totalMonths || "50"}
                  value={myTurn}
                  onChange={(e) => setMyTurn(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="km-start" className="text-xs font-semibold">
                  Shuru Hone ka Mahina
                </Label>
                <Input
                  id="km-start"
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="km-notes" className="text-xs font-semibold">
                Notes (Optional)
              </Label>
              <Input
                id="km-notes"
                placeholder="e.g. Organizer: Tariq Bhai, JazzCash pe bhejna hai"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Kameti</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
