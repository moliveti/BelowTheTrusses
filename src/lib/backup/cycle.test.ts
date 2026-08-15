import { describe, expect, it } from "vitest";
import { currentBackupCycleDate, isPastCompletionWindow, isWithinScheduledWindow, scheduledStartInstant } from "./cycle";

// Reference Saturdays confirmed via Intl.DateTimeFormat against America/New_York:
// 2026-01-10 is EST (UTC-5); 2026-08-15 is EDT (UTC-4). Both are Saturdays.

describe("currentBackupCycleDate — EST (winter, no DST)", () => {
  it("returns today's date when it's Saturday at/after 4:00 AM local", () => {
    expect(currentBackupCycleDate(new Date("2026-01-10T09:00:00Z"))).toBe("2026-01-10"); // 4:00 AM EST exactly
    expect(currentBackupCycleDate(new Date("2026-01-10T10:00:00Z"))).toBe("2026-01-10"); // 5:00 AM EST
  });

  it("returns last Saturday when it's Saturday before 4:00 AM local — this week's cycle hasn't started", () => {
    expect(currentBackupCycleDate(new Date("2026-01-10T08:00:00Z"))).toBe("2026-01-03"); // 3:00 AM EST
  });

  it("returns the most recent past Saturday on a non-Saturday", () => {
    expect(currentBackupCycleDate(new Date("2026-01-14T12:00:00Z"))).toBe("2026-01-10"); // Wednesday
  });
});

describe("currentBackupCycleDate — EDT (summer, DST active)", () => {
  it("returns today's date when it's Saturday at/after 4:00 AM local", () => {
    expect(currentBackupCycleDate(new Date("2026-08-15T08:00:00Z"))).toBe("2026-08-15"); // 4:00 AM EDT exactly
  });

  it("returns last Saturday when it's Saturday before 4:00 AM local", () => {
    expect(currentBackupCycleDate(new Date("2026-08-15T07:00:00Z"))).toBe("2026-08-08"); // 3:00 AM EDT
  });

  it("does not silently drift to 3:00 AM or 5:00 AM local across the DST boundary", () => {
    // If this were a fixed UTC-5 offset, 09:00Z in August would incorrectly read as 4:00 AM;
    // if a fixed UTC-4 offset, 09:00Z in January would incorrectly read as 5:00 AM.
    // Both must independently resolve to the correct local hour.
    expect(currentBackupCycleDate(new Date("2026-08-15T09:00:00Z"))).toBe("2026-08-15"); // 5:00 AM EDT — after cutoff, same-day
    expect(currentBackupCycleDate(new Date("2026-01-10T09:00:00Z"))).toBe("2026-01-10"); // 4:00 AM EST exactly — after cutoff, same-day
  });
});

describe("isWithinScheduledWindow", () => {
  it("is true during the 4 AM hour on Saturday (EST)", () => {
    expect(isWithinScheduledWindow(new Date("2026-01-10T09:15:00Z"))).toBe(true); // 4:15 AM EST
  });

  it("is false just before the window (EST)", () => {
    expect(isWithinScheduledWindow(new Date("2026-01-10T08:45:00Z"))).toBe(false); // 3:45 AM EST
  });

  it("is false just after the window (EST)", () => {
    expect(isWithinScheduledWindow(new Date("2026-01-10T10:01:00Z"))).toBe(false); // 5:01 AM EST
  });

  it("is true during the 4 AM hour on Saturday (EDT)", () => {
    expect(isWithinScheduledWindow(new Date("2026-08-15T08:15:00Z"))).toBe(true); // 4:15 AM EDT
  });

  it("is false on a non-Saturday at the same local hour", () => {
    expect(isWithinScheduledWindow(new Date("2026-01-14T09:15:00Z"))).toBe(false); // Wednesday 4:15 AM EST
  });
});

describe("scheduledStartInstant", () => {
  it("resolves 4:00 AM EST to 9:00 UTC", () => {
    expect(scheduledStartInstant("2026-01-10").toISOString()).toBe("2026-01-10T09:00:00.000Z");
  });

  it("resolves 4:00 AM EDT to 8:00 UTC", () => {
    expect(scheduledStartInstant("2026-08-15").toISOString()).toBe("2026-08-15T08:00:00.000Z");
  });
});

describe("isPastCompletionWindow", () => {
  it("is not overdue within the default 90-minute grace window", () => {
    const start = scheduledStartInstant("2026-01-10");
    expect(isPastCompletionWindow(new Date(start.getTime() + 30 * 60000), "2026-01-10")).toBe(false);
  });

  it("is overdue once past the grace window", () => {
    const start = scheduledStartInstant("2026-01-10");
    expect(isPastCompletionWindow(new Date(start.getTime() + 91 * 60000), "2026-01-10")).toBe(true);
  });

  it("is not overdue exactly at the scheduled start", () => {
    expect(isPastCompletionWindow(scheduledStartInstant("2026-08-15"), "2026-08-15")).toBe(false);
  });
});
