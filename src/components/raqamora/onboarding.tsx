"use client";

/**
 * RAQAMORA onboarding — 3-step wizard: name → first account → summary/finish.
 * Posts to /api/onboarding, then hands the updated user to onFinish.
 */
import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { apiSend } from "@/lib/raqamora/client";
import { parseRupeesToPaisa } from "@/lib/raqamora/money";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/raqamora/finance";
import type { SessionUser } from "@/lib/raqamora/types";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RaqamoraWordmark } from "@/components/raqamora/brand";
import { Money, Spinner } from "@/components/raqamora/kit";

export interface OnboardingProps {
  user: SessionUser;
  onFinish: (user: SessionUser) => void;
}

const STEP_LABELS = ["Your name", "First account", "Review"] as const;

export function Onboarding({ user, onFinish }: OnboardingProps) {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState(user.name ?? "");
  const [accountName, setAccountName] = React.useState("");
  const [accountType, setAccountType] = React.useState<AccountType>("CASH");
  const [openingBalance, setOpeningBalance] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const openingPaisa = React.useMemo(() => {
    const trimmed = openingBalance.trim();
    if (!trimmed) return 0;
    return parseRupeesToPaisa(trimmed);
  }, [openingBalance]);

  function validateStep(s: number): boolean {
    const errors: Record<string, string> = {};
    if (s === 0 && name.trim().length === 0) errors.name = "Please tell us your name.";
    if (s === 1) {
      if (accountName.trim().length === 0) errors.accountName = "Give your account a name, e.g. Cash in hand.";
      if (openingBalance.trim() && openingPaisa === null) errors.openingBalance = "Enter a valid amount.";
      else if (openingPaisa !== null && openingPaisa < 0) errors.openingBalance = "Opening balance cannot be negative.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(2, s + 1));
  }

  async function finish() {
    setServerError(null);
    setSubmitting(true);
    try {
      const { user: updated } = await apiSend<{ user: SessionUser }>("/api/onboarding", "POST", {
        name: name.trim(),
        accountName: accountName.trim(),
        accountType,
        openingBalanceRupees: openingPaisa === null ? 0 : openingPaisa / 100,
      });
      onFinish(updated);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not finish setup. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <RaqamoraWordmark size="md" />
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-5 shadow-raised sm:p-6">
          {/* Step indicator */}
          <ol className="mb-6 flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={label}>
                {i > 0 ? <li aria-hidden className="h-px flex-1 bg-hairline" /> : null}
                <li className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                      i < step
                        ? "bg-brand-emerald text-white"
                        : i === step
                          ? "border-2 border-brand-emerald text-brand-emerald"
                          : "bg-muted text-ink-soft",
                    )}
                    aria-current={i === step ? "step" : undefined}
                  >
                    {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:block",
                      i === step ? "text-ink" : "text-ink-soft",
                    )}
                  >
                    {label}
                  </span>
                </li>
              </React.Fragment>
            ))}
          </ol>

          {serverError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Setup failed</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          {step === 0 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-ink">What should we call you?</h2>
                <p className="mt-0.5 text-sm text-ink-soft">This name appears across your ledgers and reports.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-name">Your name</Label>
                <Input
                  id="ob-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayesha Khan"
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  className="min-h-10"
                />
                {fieldErrors.name ? <p className="text-xs text-danger-brand">{fieldErrors.name}</p> : null}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-ink">Your first account</h2>
                <p className="mt-0.5 text-sm text-ink-soft">
                  Where do you keep money day-to-day? You can add Cash, Bank, Easypaisa, JazzCash and more later.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-account-name">Account name</Label>
                <Input
                  id="ob-account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Cash in hand"
                  aria-invalid={Boolean(fieldErrors.accountName)}
                  className="min-h-10"
                />
                {fieldErrors.accountName ? <p className="text-xs text-danger-brand">{fieldErrors.accountName}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-account-type">Account type</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
                  <SelectTrigger id="ob-account-type" className="min-h-10 w-full">
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ACCOUNT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-opening">Opening balance (Rs, optional)</Label>
                <Input
                  id="ob-opening"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0"
                  aria-invalid={Boolean(fieldErrors.openingBalance)}
                  className="money min-h-10"
                />
                <p className="text-xs text-ink-soft">Opening balance is not counted as income.</p>
                {fieldErrors.openingBalance ? (
                  <p className="text-xs text-danger-brand">{fieldErrors.openingBalance}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-ink">Review &amp; finish</h2>
                <p className="mt-0.5 text-sm text-ink-soft">A quick look before we set things up.</p>
              </div>
              <dl className="space-y-2 rounded-xl border border-hairline bg-ivory p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-soft">Name</dt>
                  <dd className="font-medium text-ink">{name.trim()}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-soft">Account</dt>
                  <dd className="font-medium text-ink">{accountName.trim()}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-soft">Type</dt>
                  <dd className="font-medium text-ink">{ACCOUNT_TYPE_LABELS[accountType]}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-soft">Opening balance</dt>
                  <dd>
                    <Money value={openingPaisa ?? 0} size="sm" />
                  </dd>
                </div>
              </dl>
              <div className="rounded-xl border border-brand-emerald/25 bg-brand-emerald/[0.06] p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-emerald-deep">
                  <Sparkles className="size-3.5" aria-hidden />
                  What happens next
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-soft">
                  <li>Your account appears on the dashboard with its opening balance.</li>
                  <li>The opening balance is not counted as income.</li>
                  <li>Use the + button any time to log income, expenses or a lend.</li>
                </ul>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" className="min-h-10" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < 2 ? (
              <Button className="min-h-10" onClick={next}>
                Continue
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button className="min-h-10" onClick={() => void finish()} disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner className="size-4 text-current" /> Setting up…
                  </>
                ) : (
                  "Finish setup"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
