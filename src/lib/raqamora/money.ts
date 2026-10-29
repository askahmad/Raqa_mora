/**
 * RAQAMORA money utilities — PKR amounts handled as integer paisa (1 PKR = 100 paisa).
 * Never use binary floats for authoritative totals. All arithmetic on integers.
 */

export const PAISA_PER_RUPEE = 100;

/** Parse a user-entered rupee amount ("12,500", "12500.5", "Rs 1250") into paisa. Returns null if invalid. */
export function parseRupeesToPaisa(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const paisa = Math.round(input * PAISA_PER_RUPEE);
    return paisa;
  }
  const cleaned = input.replace(/,/g, "").replace(/[^\d.\-]/g, "").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * PAISA_PER_RUPEE);
}

/** Format paisa into a display rupee string, e.g. 125050 -> "1,250.50". */
export function formatRupees(paisa: number, opts?: { withDecimals?: boolean }): string {
  const negative = paisa < 0;
  const abs = Math.abs(Math.round(paisa));
  const rupees = Math.floor(abs / PAISA_PER_RUPEE);
  const rem = abs % PAISA_PER_RUPEE;
  const rupeeStr = rupees.toLocaleString("en-PK");
  const withDecimals = opts?.withDecimals ?? rem !== 0;
  const body = withDecimals
    ? `${rupeeStr}.${rem.toString().padStart(2, "0")}`
    : rupeeStr;
  return negative ? `-${body}` : body;
}

/** Format paisa as PKR currency, e.g. "Rs 1,250.50" or "Rs -1,250". */
export function formatPKR(paisa: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    const abs = Math.abs(paisa);
    const sign = paisa < 0 ? "-" : "";
    if (abs >= 100000 * PAISA_PER_RUPEE) {
      const lakh = abs / (100000 * PAISA_PER_RUPEE);
      return `Rs ${sign}${trimZeros(lakh)}L`;
    }
    if (abs >= 1000 * PAISA_PER_RUPEE) {
      const k = abs / (1000 * PAISA_PER_RUPEE);
      return `Rs ${sign}${trimZeros(k)}K`;
    }
  }
  const negative = paisa < 0 ? "-" : "";
  return `Rs ${negative}${formatRupees(Math.abs(paisa))}`;
}

function trimZeros(n: number): string {
  const s = n.toFixed(n % 1 === 0 ? 0 : 1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Safe integer money addition. */
export function addPaisa(a: number, b: number): number {
  return Math.round(a) + Math.round(b);
}

/** Validate a positive paisa amount (> 0). */
export function isPositivePaisa(paisa: number): boolean {
  return Number.isInteger(paisa) && paisa > 0;
}
