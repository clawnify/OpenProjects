// Dates and sizes as people read them, in the viewer's own language.

const at = (d: string) => new Date(`${d}T00:00:00Z`);

/** The typographic range dash, written as an escape so it reads as data. */
const RANGE = "–";

export function shortDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" }).format(at(d));
}

export function longDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(at(d));
}

export function monthName(d: string, withYear: boolean): string {
  return new Intl.DateTimeFormat(undefined, { month: withYear ? "short" : "long", year: withYear ? "numeric" : undefined, timeZone: "UTC" }).format(at(d));
}

/** "2 Dec to 6 Dec" with a range dash, or one date for a one-day span. */
export function dateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  return start === end ? shortDate(start) : `${shortDate(start)} ${RANGE} ${shortDate(end)}`;
}

export function days(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function when(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
