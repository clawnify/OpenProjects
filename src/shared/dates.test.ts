import { describe, expect, it } from "vitest";
import { addDays, addMonths, diffDays, isDate, isoWeek, overlaps, spanDays, weekStart, weekday } from "./dates";

describe("dates", () => {
  it("adds days across a month, a year and a DST change", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // EU clocks go forward on 29 March
    expect(addDays("2026-03-02", -2)).toBe("2026-02-28");
  });

  it("counts days and inclusive spans", () => {
    expect(diffDays("2026-11-24", "2026-11-24")).toBe(0);
    expect(diffDays("2026-11-24", "2026-12-01")).toBe(7);
    expect(diffDays("2026-12-01", "2026-11-24")).toBe(-7);
    expect(spanDays("2026-11-24", "2026-11-24")).toBe(1);
    expect(spanDays("2026-11-23", "2026-11-27")).toBe(5);
  });

  it("refuses dates that do not exist", () => {
    expect(isDate("2026-02-28")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2028-02-29")).toBe(true);
    expect(isDate("26-02-01")).toBe(false);
  });

  it("starts weeks on Monday and numbers them per ISO 8601", () => {
    expect(weekday("2026-11-23")).toBe(0); // Monday
    expect(weekday("2026-11-29")).toBe(6); // Sunday
    expect(weekStart("2026-11-29")).toBe("2026-11-23");
    expect(isoWeek("2026-11-24")).toBe(48);
    expect(isoWeek("2027-01-01")).toBe(53); // a Friday: still week 53 of 2026
    expect(isoWeek("2027-01-04")).toBe(1);
    expect(isoWeek("2024-12-30")).toBe(1); // a Monday that belongs to 2025's week 1
  });

  it("moves by months from any day", () => {
    expect(addMonths("2026-11-24", 1)).toBe("2026-12-01");
    expect(addMonths("2026-11-24", 2)).toBe("2027-01-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("treats spans as inclusive when checking overlap", () => {
    expect(overlaps("2026-12-01", "2026-12-05", "2026-12-05", "2026-12-09")).toBe(true);
    expect(overlaps("2026-12-01", "2026-12-04", "2026-12-05", "2026-12-09")).toBe(false);
  });
});
