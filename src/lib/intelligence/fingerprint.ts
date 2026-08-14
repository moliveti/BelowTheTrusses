import { createHash } from "node:crypto";

/**
 * A stable, deterministic UUID-shaped id for a signal that isn't about one
 * specific database row (e.g. "this year's forecast is concentrated in one
 * month" describes the whole book of business, not a single project).
 * `recommendations.source_id` is `uuid not null`, so aggregate-level signals
 * need something that satisfies that column — this hashes a stable seed
 * (type + period key) into a UUID-formatted string. It is NOT a real primary
 * key anywhere; it exists purely so the same seed always upserts the same
 * recommendations row instead of creating a new one every run.
 */
export function syntheticSourceId(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), "4" + hex.slice(13, 16), "a" + hex.slice(17, 20), hex.slice(20, 32)].join(
    "-"
  );
}

/** Buckets a day count into a coarse label so a fingerprint doesn't drift on every calendar day. */
export function dayBucket(days: number, boundaries: number[]): string {
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (days >= boundaries[i]) {
      const next = boundaries[i + 1];
      return next === undefined ? `${boundaries[i]}+` : `${boundaries[i]}-${next - 1}`;
    }
  }
  return `0-${boundaries[0] - 1}`;
}

export function buildFingerprint(type: string, parts: (string | number | null)[]): string {
  return [type, ...parts.map((p) => String(p ?? "null"))].join(":");
}
