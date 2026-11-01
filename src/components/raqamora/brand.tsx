"use client";

/**
 * RAQAMORA brand marks — a geometric monogram built from pure SVG shapes:
 * an emerald stem + a champagne-gold bowl & leg forming the "R" on a navy tile.
 * No stock logos, no images.
 */
import { cn } from "@/lib/utils";

const TILE = { navy: "#101C2C", emerald: "#2FA98F", gold: "#C5A46D" } as const;

export function Monogram({ className, title = "RAQAMORA monogram" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={title} className={cn("shrink-0", className)}>
      <rect x="1" y="1" width="46" height="46" rx="11" fill={TILE.navy} />
      <rect x="1" y="1" width="46" height="46" rx="11" fill="none" stroke={TILE.gold} strokeOpacity="0.35" />
      {/* stem */}
      <rect x="15" y="11" width="5.5" height="26" rx="2.75" fill={TILE.emerald} />
      {/* bowl */}
      <path
        d="M20.5 13.75 H26.5 A7.25 7.25 0 0 1 26.5 28.25 H20.5"
        fill="none"
        stroke={TILE.gold}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* leg */}
      <path d="M25.5 27.5 L33 37" fill="none" stroke={TILE.gold} strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

export type WordmarkSize = "sm" | "md" | "lg";

const SIZE_TILE: Record<WordmarkSize, string> = {
  sm: "size-6 rounded-[7px]",
  md: "size-8 rounded-[9px]",
  lg: "size-11 rounded-xl",
};

const SIZE_TEXT: Record<WordmarkSize, string> = {
  sm: "text-[13px] tracking-[0.14em]",
  md: "text-base tracking-[0.16em]",
  lg: "text-xl tracking-[0.18em]",
};

export function RaqamoraWordmark({
  size = "md",
  tone = "onLight",
  className,
}: {
  size?: WordmarkSize;
  /** onLight = navy text for ivory surfaces; onDark = ivory text for navy surfaces */
  tone?: "onLight" | "onDark";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Monogram className={cn(SIZE_TILE[size], "rounded-[inherit] shadow-card")} />
      <span
        className={cn(
          "font-semibold leading-none",
          SIZE_TEXT[size],
          tone === "onLight" ? "text-navy dark:text-white" : "text-ivory",
        )}
      >
        RAQAMORA
      </span>
    </span>
  );
}
