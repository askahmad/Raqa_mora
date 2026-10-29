/**
 * RAQAMORA API date helpers — Asia/Karachi (UTC+5, no DST) day/month/year
 * boundaries and recurrence arithmetic.
 *
 * Convention (mirrors `karachiDayRange` / `karachiNow` in @/lib/server/data):
 * a "shifted" Date is a real instant + 5h whose UTC parts read as Karachi
 * wall-clock time. Range helpers take a shifted date and return REAL instants
 * usable directly in Prisma `date` filters.
 */
export const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Convert a real instant into its Karachi wall-clock view (instant + 5h). */
export function karachiShift(d: Date): Date {
  return new Date(d.getTime() + KARACHI_OFFSET_MS);
}

/** Real instant whose Karachi wall-clock parts equal the given shifted date's UTC parts. */
export function karachiUnshift(shifted: Date): Date {
  return new Date(shifted.getTime() - KARACHI_OFFSET_MS);
}

/** "YYYY-MM-DD" (Karachi calendar day) of a real instant. */
export function karachiDayKey(real: Date): string {
  return karachiShift(real).toISOString().slice(0, 10);
}

/** "YYYY-MM" (Karachi month) of a real instant. */
export function karachiMonthKeyOf(real: Date): string {
  return karachiShift(real).toISOString().slice(0, 7);
}

/** Karachi week range (Monday-start) containing the given shifted date. */
export function karachiWeekRange(shifted: Date): { from: Date; to: Date } {
  const midnight = new Date(shifted);
  midnight.setUTCHours(0, 0, 0, 0);
  const dow = midnight.getUTCDay(); // 0=Sun .. 6=Sat
  const back = (dow + 6) % 7; // days since Monday
  const monday = midnight.getTime() - back * DAY_MS;
  return {
    from: new Date(monday - KARACHI_OFFSET_MS),
    to: new Date(monday + 7 * DAY_MS - 1 - KARACHI_OFFSET_MS),
  };
}

/** Karachi calendar-month range containing the given shifted date. */
export function karachiMonthRange(shifted: Date): { from: Date; to: Date } {
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m, 1) - KARACHI_OFFSET_MS),
    to: new Date(Date.UTC(y, m + 1, 1) - 1 - KARACHI_OFFSET_MS),
  };
}

/** Karachi calendar-year range containing the given shifted date. */
export function karachiYearRange(shifted: Date): { from: Date; to: Date } {
  const y = shifted.getUTCFullYear();
  return {
    from: new Date(Date.UTC(y, 0, 1) - KARACHI_OFFSET_MS),
    to: new Date(Date.UTC(y + 1, 0, 1) - 1 - KARACHI_OFFSET_MS),
  };
}

/** {from,to} real instants covering a "YYYY-MM" Karachi month key. */
export function karachiMonthRangeFromKey(month: string): { from: Date; to: Date } {
  const [ys, ms] = month.split("-");
  const y = Number(ys);
  const m = Number(ms) - 1;
  return {
    from: new Date(Date.UTC(y, m, 1) - KARACHI_OFFSET_MS),
    to: new Date(Date.UTC(y, m + 1, 1) - 1 - KARACHI_OFFSET_MS),
  };
}

/**
 * Advance a real instant by one recurrence frequency. DAILY/WEEKLY shift by a
 * fixed duration; MONTHLY/YEARLY add calendar months/years on the Karachi
 * calendar, clamping day-of-month (e.g. Jan 31 -> Feb 28, Feb 29 -> Feb 28).
 */
export function advanceKarachi(real: Date, frequency: string): Date {
  if (frequency === "DAILY") return new Date(real.getTime() + DAY_MS);
  if (frequency === "WEEKLY") return new Date(real.getTime() + 7 * DAY_MS);
  if (frequency !== "MONTHLY" && frequency !== "YEARLY") {
    // Unknown frequency: safe fallback of one day.
    return new Date(real.getTime() + DAY_MS);
  }
  const v = karachiShift(real);
  let y = v.getUTCFullYear();
  let m = v.getUTCMonth();
  if (frequency === "MONTHLY") m += 1;
  else y += 1;
  if (m > 11) {
    y += Math.floor(m / 12);
    m = m % 12;
  }
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(v.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      y, m, day,
      v.getUTCHours(), v.getUTCMinutes(), v.getUTCSeconds(), v.getUTCMilliseconds(),
    ) - KARACHI_OFFSET_MS,
  );
}

/** Build a real instant for a Karachi wall-clock Y/M/D (default noon local). */
export function karachiDate(y: number, m: number, d: number, hours = 12, minutes = 0): Date {
  return new Date(Date.UTC(y, m, d, hours, minutes) - KARACHI_OFFSET_MS);
}

/** "YYYYMMDD" stamp (Karachi) for export filenames. */
export function karachiStamp(real: Date): string {
  return karachiShift(real).toISOString().slice(0, 10).replace(/-/g, "");
}
