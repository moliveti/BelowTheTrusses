import { describe, expect, it } from "vitest";
import { decideLifecycle, reconcileMissing, type ExistingRecommendationState } from "./lifecycle";

const ASOF = new Date("2026-08-15T12:00:00Z");

function state(overrides: Partial<ExistingRecommendationState>): ExistingRecommendationState {
  return {
    status: "active",
    fingerprintAtAction: null,
    severityAtAction: null,
    snoozedUntil: null,
    ...overrides,
  };
}

describe("decideLifecycle", () => {
  it("keeps an active recommendation active", () => {
    expect(decideLifecycle(state({ status: "active" }), "fp:a", "medium", ASOF).nextStatus).toBe("active");
  });

  describe("dismissed", () => {
    it("preserves dismissed when the fingerprint is unchanged", () => {
      const d = decideLifecycle(
        state({ status: "dismissed", fingerprintAtAction: "fp:a" }),
        "fp:a",
        "medium",
        ASOF
      );
      expect(d.nextStatus).toBe("dismissed");
      expect(d.restarted).toBe(false);
    });

    it("restarts when the fingerprint changed, even at the same severity", () => {
      const d = decideLifecycle(
        state({ status: "dismissed", fingerprintAtAction: "fp:a", severityAtAction: "medium" }),
        "fp:b",
        "medium",
        ASOF
      );
      expect(d.nextStatus).toBe("active");
      expect(d.restarted).toBe(true);
    });
  });

  describe("handled", () => {
    it("preserves handled when the same condition recurs at an identical fingerprint", () => {
      const d = decideLifecycle(state({ status: "handled", fingerprintAtAction: "fp:a" }), "fp:a", "low", ASOF);
      expect(d.nextStatus).toBe("handled");
    });

    it("restarts when a materially different fingerprint appears on the same record", () => {
      const d = decideLifecycle(state({ status: "handled", fingerprintAtAction: "fp:a" }), "fp:c", "low", ASOF);
      expect(d.nextStatus).toBe("active");
      expect(d.restarted).toBe(true);
    });
  });

  describe("snoozed", () => {
    it("stays snoozed while within the window even if the fingerprint changed but severity did not escalate", () => {
      const d = decideLifecycle(
        state({
          status: "snoozed",
          fingerprintAtAction: "fp:a",
          severityAtAction: "medium",
          snoozedUntil: "2026-08-20",
        }),
        "fp:b",
        "medium",
        ASOF
      );
      expect(d.nextStatus).toBe("snoozed");
    });

    it("wakes early when severity escalates while still snoozed", () => {
      const d = decideLifecycle(
        state({
          status: "snoozed",
          fingerprintAtAction: "fp:a",
          severityAtAction: "medium",
          snoozedUntil: "2026-08-20",
        }),
        "fp:b",
        "critical",
        ASOF
      );
      expect(d.nextStatus).toBe("active");
      expect(d.restarted).toBe(true);
    });

    it("does not wake early on fingerprint change alone without severity escalating", () => {
      const d = decideLifecycle(
        state({
          status: "snoozed",
          fingerprintAtAction: "fp:a",
          severityAtAction: "high",
          snoozedUntil: "2026-08-20",
        }),
        "fp:b",
        "medium",
        ASOF
      );
      expect(d.nextStatus).toBe("snoozed");
    });

    it("wakes once the snooze window has elapsed, regardless of fingerprint", () => {
      const d = decideLifecycle(
        state({ status: "snoozed", fingerprintAtAction: "fp:a", snoozedUntil: "2026-08-10" }),
        "fp:a",
        "medium",
        ASOF
      );
      expect(d.nextStatus).toBe("active");
      expect(d.restarted).toBe(true);
    });
  });

  describe("resolved", () => {
    it("reactivates once the condition is seen again", () => {
      const d = decideLifecycle(state({ status: "resolved" }), "fp:a", "medium", ASOF);
      expect(d.nextStatus).toBe("active");
      expect(d.restarted).toBe(true);
    });
  });
});

describe("reconcileMissing", () => {
  it("resolves an active recommendation no longer produced by a run", () => {
    expect(reconcileMissing("active")).toBe("resolved");
  });

  it("resolves a snoozed recommendation no longer produced by a run", () => {
    expect(reconcileMissing("snoozed")).toBe("resolved");
  });

  it("leaves dismissed/handled/resolved alone", () => {
    expect(reconcileMissing("dismissed")).toBe("dismissed");
    expect(reconcileMissing("handled")).toBe("handled");
    expect(reconcileMissing("resolved")).toBe("resolved");
  });
});
