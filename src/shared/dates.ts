// Calendar dates as 'YYYY-MM-DD' strings. All arithmetic is done in UTC so a
// date never shifts by a day across a daylight-saving change or a time zone.
// Used by both the API (validation, shifting a plan) and the timeline.

export const DATE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;

function toUtc(d: string): number {
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True for a real calendar date, so 2026-02-30 is refused. */
export function isDate(d: string): boolean {
  return DATE.test(d) && fromUtc(toUtc(d)) === d;
}

export function addDays(d: string, n: number): string {
  return fromUtc(toUtc(d) + n * DAY_MS);
}

/** Days from a to b: 0 for the same day, negative when b is earlier. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Inclusive length of a span: a one-day phase lasts 1 day. */
export function spanDays(start: string, end: string): number {
  return diffDays(start, end) + 1;
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(d: string): number {
  return (new Date(toUtc(d)).getUTCDay() + 6) % 7;
}

export function isWeekend(d: string): boolean {
  return weekday(d) >= 5;
}

/** The Monday of the ISO week a date falls in. */
export function weekStart(d: string): string {
  return addDays(d, -weekday(d));
}

/** ISO 8601 week number (weeks start Monday; week 1 holds the first Thursday). */
export function isoWeek(d: string): number {
  const thursday = addDays(d, 3 - weekday(d));
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor(diffDays(jan1, thursday) / 7) + 1;
}

export function monthStart(d: string): string {
  return `${d.slice(0, 7)}-01`;
}

export function addMonths(d: string, n: number): string {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7)) - 1 + n;
  return fromUtc(Date.UTC(y + Math.floor(m / 12), ((m % 12) + 12) % 12, 1));
}

/** Two inclusive spans share at least one day. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function today(): string {
  const now = new Date();
  // The viewer's own calendar day, not UTC's: at 00:30 in Amsterdam it is
  // already tomorrow there, and "today" should say so.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
