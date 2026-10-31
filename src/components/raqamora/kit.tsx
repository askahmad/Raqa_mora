"use client";

/**
 * RAQAMORA shared UI kit — compact fintech primitives used by every view.
 * Money is integer paisa; all figures render with tabular numerals.
 */
import * as React from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/raqamora/money";
import { TXN_TYPE_LABELS, type TxnType } from "@/lib/raqamora/finance";
import type { SessionUser } from "@/lib/raqamora/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { startDemoSession } from "@/components/raqamora/demo";

/* ------------------------------------------------------------------ Money */

export type MoneySize = "sm" | "md" | "lg" | "xl";

const MONEY_SIZES: Record<MoneySize, string> = {
  sm: "text-[13px] font-medium",
  md: "text-[15px] font-semibold",
  lg: "text-lg font-semibold tracking-tight",
  xl: "text-2xl font-semibold tracking-tight md:text-[26px]",
};

export function Money({
  value,
  className,
  size = "md",
  colored = false,
}: {
  value: number; // paisa
  className?: string;
  size?: MoneySize;
  colored?: boolean; // emerald positive / red negative
}) {
  const tone = colored
    ? value > 0
      ? "text-money-pos"
      : value < 0
        ? "text-money-neg"
        : undefined
    : undefined;
  return (
    <span className={cn("money inline-block", MONEY_SIZES[size], tone, className)}>
      {formatPKR(value)}
    </span>
  );
}

/* --------------------------------------------------------------- StatCard */

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: number; // paisa
  sub?: React.ReactNode;
  icon?: LucideIcon;
  trend?: { label: string; positive?: boolean };
  className?: string;
}) {
  return (
    <div className={cn("spotlight-card rounded-2xl border border-hairline/80 bg-card p-3.5 sm:p-4.5 shadow-card transition-all active:scale-[0.99]", className)}>
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.06em] text-ink-soft">
          {label}
        </span>
        {Icon ? (
          <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-emerald/15 to-brand-emerald/5 text-brand-emerald shadow-2xs border border-brand-emerald/15">
            <Icon className="size-3.5 sm:size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Money value={value} size="md" className="text-lg sm:text-[22px] font-extrabold tracking-tight text-ink" />
        {trend ? (
          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0 text-[10px] font-semibold leading-tight rounded-md",
              trend.positive === false
                ? "border-danger-brand/25 bg-danger-brand/10 text-danger-brand"
                : "border-brand-emerald/25 bg-brand-emerald/10 text-brand-emerald-deep",
            )}
          >
            {trend.label}
          </Badge>
        ) : null}
      </div>
      {sub ? <p className="mt-1.5 truncate text-[11px] sm:text-xs leading-relaxed text-ink-soft font-medium">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------ SectionCard */

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const hasHeader = Boolean(title || subtitle || action);
  return (
    <section className={cn("rounded-3xl border border-hairline/80 bg-card shadow-card transition-all overflow-hidden", className)}>
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 px-4.5 pb-2.5 pt-4.5 sm:px-6 sm:pt-5 border-b border-hairline/40">
          <div className="min-w-0">
            {title ? <h2 className="text-sm sm:text-base font-bold text-ink tracking-tight">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-ink-soft font-medium">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-4.5 sm:p-6", contentClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-ink-soft">
          <Icon className="size-4.5" aria-hidden />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button size="sm" className="mt-4 min-h-9" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- TypeBadge */

const TYPE_STYLES: Record<TxnType, string> = {
  INCOME: "border-brand-emerald/25 bg-brand-emerald/10 text-brand-emerald-deep dark:border-brand-emerald/35 dark:bg-brand-emerald/20 dark:text-[#53c6ac]",
  EXPENSE:
    "border-danger-brand/20 bg-danger-brand/[0.08] text-[#93392f] dark:border-danger-brand/30 dark:bg-danger-brand/15 dark:text-[#e08a7f]",
  TRANSFER:
    "border-sky-600/20 bg-sky-600/10 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-[#7cc4ed]",
  LENT: "border-warn-brand/25 bg-warn-brand/10 text-[#7c5d1d] dark:border-warn-brand/35 dark:bg-warn-brand/20 dark:text-[#d9b25f]",
  BORROWED:
    "border-gold/30 bg-gold/15 text-[#6e5527] dark:border-gold/35 dark:bg-gold/20 dark:text-[#dcc494]",
  REPAYMENT_RECEIVED:
    "border-brand-emerald/30 bg-brand-emerald/[0.06] text-brand-emerald-deep dark:border-brand-emerald/40 dark:bg-brand-emerald/15 dark:text-[#53c6ac]",
  REPAYMENT_MADE:
    "border-danger-brand/30 bg-danger-brand/[0.06] text-[#93392f] dark:border-danger-brand/40 dark:bg-danger-brand/15 dark:text-[#e08a7f]",
  REFUND:
    "border-brand-emerald/25 bg-transparent text-brand-emerald-deep dark:border-brand-emerald/35 dark:text-[#53c6ac]",
  ADJUSTMENT: "border-border bg-muted text-muted-foreground",
};

export function TypeBadge({ type, className }: { type: TxnType | string; className?: string }) {
  const key = (TXN_TYPE_LABELS[type as TxnType] ? type : "ADJUSTMENT") as TxnType;
  return (
    <Badge variant="outline" className={cn("px-1.5 text-[10px] font-medium", TYPE_STYLES[key], className)}>
      {TXN_TYPE_LABELS[key]}
    </Badge>
  );
}

/* ---------------------------------------------------------- Loading bits */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-muted-foreground", className)} aria-hidden />;
}

export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-hairline bg-card p-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- ConfirmDialog */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30")}
            disabled={loading}
            onClick={(e) => {
              // Keep the dialog open while the parent runs the async confirm.
              e.preventDefault();
              void onConfirm();
            }}
          >
            {loading ? <Spinner className="size-4 text-current" /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------ PageHeader */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-0.5 text-xs sm:text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- DemoButton */

export function DemoButton({
  onDemo,
  className,
  size = "sm",
  variant = "outline",
  label = "Explore live demo — sample data",
}: {
  onDemo: (user: SessionUser) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "secondary" | "ghost";
  label?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          onDemo(await startDemoSession());
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not start the demo. Please try again.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Spinner className="size-4 text-current" /> : null}
      {loading ? "Preparing demo…" : label}
    </Button>
  );
}
