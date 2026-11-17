// The day buckets of the dashboard's revenue chart (src/lib/dashboard.ts).
// It imports db.ts, which only connects on first use, so no database is
// needed here.
import { describe, expect, it } from "vitest";
import { dailyTotals } from "../../src/lib/dashboard";

describe("dailyTotals", () => {
  const today = new Date("2026-11-17T09:30:00Z");

  it("has one entry per day, oldest first, with 0 for days without sales", () => {
    const days = dailyTotals([], 3, today);
    expect(days).toEqual([
      { day: "2026-11-15", cents: 0 },
      { day: "2026-11-16", cents: 0 },
      { day: "2026-11-17", cents: 0 },
    ]);
  });

  it("adds up the payments of each UTC day and skips older ones", () => {
    const days = dailyTotals(
      [
        { paidAt: new Date("2026-11-17T00:00:00Z"), cents: 2999 },
        { paidAt: new Date("2026-11-17T23:59:59Z"), cents: 4999 },
        { paidAt: new Date("2026-11-16T12:00:00Z"), cents: 100 },
        { paidAt: new Date("2026-11-10T12:00:00Z"), cents: 99999 }, // too old
      ],
      2,
      today,
    );
    expect(days).toEqual([
      { day: "2026-11-16", cents: 100 },
      { day: "2026-11-17", cents: 7998 },
    ]);
  });

  it("crosses month ends", () => {
    const days = dailyTotals([], 2, new Date("2026-12-01T01:00:00Z"));
    expect(days.map((day) => day.day)).toEqual(["2026-11-30", "2026-12-01"]);
  });
});
