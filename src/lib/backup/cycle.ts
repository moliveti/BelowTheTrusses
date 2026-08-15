/**
 * All backup-cycle math is anchored to Saturday 4:00 AM America/New_York —
 * computed fresh from IANA timezone data on every call (Intl.DateTimeFormat),
 * never a fixed UTC offset, so DST transitions never silently move the
 * effective local time. See docs/BTT_DISASTER_RECOVERY.md.
 */

interface NyParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun..6=Sat
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function nyParts(utcInstant: Date): NyParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(utcInstant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour");
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: hour === "24" ? 0 : Number(hour), // some ICU implementations render midnight as "24"
    minute: Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? -1,
  };
}

/** GMT offset in minutes (negative west of UTC) America/New_York is running at the given instant — resolves EST (-300) vs EDT (-240) for that specific date. */
function nyOffsetMinutes(utcInstant: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" });
  const label = fmt.formatToParts(utcInstant).find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const match = label.match(/GMT([+-]\d+)/);
  return (match ? Number(match[1]) : -5) * 60;
}

/**
 * The Saturday (YYYY-MM-DD, no time component — this is a plain calendar
 * date in America/New_York terms) whose 4:00 AM cycle governs "now": today
 * if it's Saturday at/after 4:00 AM local, last Saturday if it's Saturday
 * before 4:00 AM local (this week's cycle hasn't started), otherwise the
 * most recent Saturday.
 */
export function currentBackupCycleDate(nowUtc: Date): string {
  const p = nyParts(nowUtc);
  const daysSinceSaturday = (p.weekday - 6 + 7) % 7;
  let cycleDaysBack = daysSinceSaturday;
  if (daysSinceSaturday === 0 && p.hour < 4) cycleDaysBack = 7;

  // Pure calendar arithmetic on the NY-local Y/M/D — Date.UTC here is just a
  // date calculator for month/year rollovers, not a real timezone-aware
  // instant, so this stays correct regardless of DST.
  const cycleDate = new Date(Date.UTC(p.year, p.month - 1, p.day - cycleDaysBack));
  return cycleDate.toISOString().slice(0, 10);
}

/** True during the scheduling window (Saturday, 4:00-4:59 AM America/New_York) — what the frequent GitHub Actions cron check uses to decide whether to actually run. */
export function isWithinScheduledWindow(nowUtc: Date): boolean {
  const p = nyParts(nowUtc);
  return p.weekday === 6 && p.hour === 4;
}

/** The real UTC instant corresponding to 4:00 AM America/New_York on a given (Saturday) cycle date. */
export function scheduledStartInstant(cycleDate: string): Date {
  const approxUtc = new Date(`${cycleDate}T09:00:00Z`); // safely past any local DST transition (2 AM) either way, close enough to resolve the correct offset for this date
  const offsetMinutes = nyOffsetMinutes(approxUtc);
  const utcMinutesFromMidnight = 4 * 60 - offsetMinutes;
  return new Date(new Date(`${cycleDate}T00:00:00Z`).getTime() + utcMinutesFromMidnight * 60000);
}

/** Overdue = past the expected completion window with nothing recorded as completed/generating for the cycle — the caller supplies that check; this only computes the time boundary. */
export function isPastCompletionWindow(nowUtc: Date, cycleDate: string, graceMinutes = 90): boolean {
  const deadline = new Date(scheduledStartInstant(cycleDate).getTime() + graceMinutes * 60000);
  return nowUtc.getTime() > deadline.getTime();
}
