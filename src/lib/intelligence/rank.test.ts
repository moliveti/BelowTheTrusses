import { describe, expect, it } from "vitest";
import { rankSignals, topPriorities } from "./rank";
import type { Signal } from "./types";

function signal(overrides: Partial<Signal>): Signal {
  return {
    type: "test",
    sourceTable: "leads",
    sourceId: "1",
    title: "t",
    reason: "r",
    severity: "medium",
    conditionFingerprint: "fp",
    metricValue: 0,
    metricLabel: null,
    context: {},
    ...overrides,
  };
}

describe("rankSignals", () => {
  it("orders critical before high before medium before low", () => {
    const signals = [signal({ severity: "low" }), signal({ severity: "critical" }), signal({ severity: "high" }), signal({ severity: "medium" })];
    expect(rankSignals(signals).map((s) => s.severity)).toEqual(["critical", "high", "medium", "low"]);
  });

  it("breaks ties within a severity by the larger metric value", () => {
    const signals = [signal({ severity: "high", metricValue: 5 }), signal({ severity: "high", metricValue: 20 })];
    expect(rankSignals(signals).map((s) => s.metricValue)).toEqual([20, 5]);
  });

  it("does not mutate the input array", () => {
    const signals = [signal({ severity: "low" }), signal({ severity: "critical" })];
    const copy = [...signals];
    rankSignals(signals);
    expect(signals).toEqual(copy);
  });
});

describe("topPriorities", () => {
  it("prefers ~5 items rather than a wall of alerts", () => {
    const signals = Array.from({ length: 20 }, (_, i) => signal({ severity: "medium", metricValue: i }));
    expect(topPriorities(signals)).toHaveLength(5);
  });

  it("returns fewer than 5 when only fewer genuinely exist", () => {
    const signals = [signal({}), signal({})];
    expect(topPriorities(signals)).toHaveLength(2);
  });
});
