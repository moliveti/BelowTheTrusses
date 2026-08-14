import { describe, expect, it } from "vitest";
import {
  agingSowSignals,
  forecastConcentrationSignal,
  outstandingBalanceSignals,
  overdueMilestoneSignals,
  staleLeadSignals,
  upcomingMilestoneSignals,
  type MilestoneForIntelligence,
} from "./facts";
import type { Lead } from "@/lib/leads/types";
import type { SowRow, RevenueRow } from "@/lib/dashboard/types";
import type { ProjectListItem } from "@/lib/projects/types";

const ASOF = new Date("2026-08-15T12:00:00Z");

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: "lead-1",
    name: "Test Lead",
    email: null,
    phone: null,
    projectType: "Residential",
    state: null,
    budgetRange: null,
    timelineStartMonth: null,
    timelineEndMonth: null,
    referralSourceId: null,
    referralSourceName: null,
    notes: null,
    scopeTags: [],
    status: "New Prospect",
    lastContactedDate: null,
    createdAt: "2026-08-01T00:00:00Z",
    convertedSowId: null,
    convertedProjectId: null,
    ...overrides,
  };
}

describe("staleLeadSignals", () => {
  it("does not flag a lead contacted 6 days ago", () => {
    const lead = makeLead({ lastContactedDate: "2026-08-09" }); // 6 days before ASOF
    expect(staleLeadSignals([lead], ASOF)).toHaveLength(0);
  });

  it("flags a lead at exactly the 7-day boundary as medium", () => {
    const lead = makeLead({ lastContactedDate: "2026-08-08" }); // exactly 7 days
    const signals = staleLeadSignals([lead], ASOF);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("medium");
    expect(signals[0].metricValue).toBe(7);
  });

  it("escalates severity across bucket boundaries", () => {
    expect(staleLeadSignals([makeLead({ lastContactedDate: "2026-08-01" })], ASOF)[0].severity).toBe("high"); // 14 days
    expect(staleLeadSignals([makeLead({ lastContactedDate: "2026-07-16" })], ASOF)[0].severity).toBe("critical"); // 30 days
  });

  it("ignores leads outside the open-status pipeline", () => {
    const lead = makeLead({ status: "Lost", lastContactedDate: "2026-06-01" });
    expect(staleLeadSignals([lead], ASOF)).toHaveLength(0);
  });

  it("falls back to createdAt when never contacted", () => {
    const lead = makeLead({ lastContactedDate: null, createdAt: "2026-07-01T00:00:00Z" });
    const signals = staleLeadSignals([lead], ASOF);
    expect(signals).toHaveLength(1);
    expect(signals[0].metricValue).toBe(45);
  });

  it("produces a fingerprint that only changes on bucket crossing, not day-to-day", () => {
    const day10 = staleLeadSignals([makeLead({ lastContactedDate: "2026-08-05" })], ASOF)[0]; // 10 days
    const day12 = staleLeadSignals(
      [makeLead({ lastContactedDate: "2026-08-03" })],
      ASOF
    )[0]; // 12 days, still in 7-13 bucket
    const day14 = staleLeadSignals([makeLead({ lastContactedDate: "2026-08-01" })], ASOF)[0]; // 14 days, next bucket
    expect(day10.conditionFingerprint).toBe(day12.conditionFingerprint);
    expect(day10.conditionFingerprint).not.toBe(day14.conditionFingerprint);
  });
});

function makeSow(overrides: Partial<SowRow>): SowRow {
  return {
    id: "sow-1",
    dateSent: "2026-08-01",
    prospectName: "Test Prospect",
    proposedFee: 10000,
    status: "Open",
    notes: null,
    ...overrides,
  };
}

describe("agingSowSignals", () => {
  it("ignores rows below the 14-day floor", () => {
    expect(agingSowSignals([makeSow({ dateSent: "2026-08-05" })], ASOF)).toHaveLength(0); // 10 days
  });

  it("ignores Declined/Converted regardless of age", () => {
    expect(agingSowSignals([makeSow({ status: "Declined", dateSent: "2026-01-01" })], ASOF)).toHaveLength(0);
    expect(agingSowSignals([makeSow({ status: "Converted", dateSent: "2026-01-01" })], ASOF)).toHaveLength(0);
  });

  it("skips rows with no date_sent rather than guessing an age", () => {
    expect(agingSowSignals([makeSow({ dateSent: null })], ASOF)).toHaveLength(0);
  });

  it("escalates through the 14/30/60 day buckets", () => {
    expect(agingSowSignals([makeSow({ dateSent: "2026-08-01" })], ASOF)[0].severity).toBe("medium"); // 14 days
    expect(agingSowSignals([makeSow({ dateSent: "2026-07-16" })], ASOF)[0].severity).toBe("high"); // 30 days
    expect(agingSowSignals([makeSow({ dateSent: "2026-06-16" })], ASOF)[0].severity).toBe("critical"); // 60 days
  });
});

function makeMilestone(overrides: Partial<MilestoneForIntelligence>): MilestoneForIntelligence {
  return {
    id: "m-1",
    projectId: "p-1",
    projectName: "Test Project",
    name: "Final Payment",
    dueDate: "2026-08-01",
    amountDue: 5000,
    amountPaid: 0,
    ...overrides,
  };
}

describe("overdueMilestoneSignals", () => {
  it("does not flag a milestone due today", () => {
    expect(overdueMilestoneSignals([makeMilestone({ dueDate: "2026-08-15" })], ASOF)).toHaveLength(0);
  });

  it("flags a milestone due yesterday", () => {
    const signals = overdueMilestoneSignals([makeMilestone({ dueDate: "2026-08-14" })], ASOF);
    expect(signals).toHaveLength(1);
    expect(signals[0].metricValue).toBe(1);
  });

  it("ignores a milestone that is already fully paid", () => {
    const m = makeMilestone({ dueDate: "2026-07-01", amountDue: 5000, amountPaid: 5000 });
    expect(overdueMilestoneSignals([m], ASOF)).toHaveLength(0);
  });

  it("uses the outstanding balance, not the full amount due, once partially paid", () => {
    const m = makeMilestone({ dueDate: "2026-08-01", amountDue: 5000, amountPaid: 2000 });
    const signals = overdueMilestoneSignals([m], ASOF);
    expect(signals[0].context.outstanding).toBe(3000);
  });

  it("skips milestones with no due date or no amount due", () => {
    expect(overdueMilestoneSignals([makeMilestone({ dueDate: null })], ASOF)).toHaveLength(0);
    expect(overdueMilestoneSignals([makeMilestone({ amountDue: null })], ASOF)).toHaveLength(0);
  });
});

describe("upcomingMilestoneSignals", () => {
  it("flags a milestone due in 3 days as high severity", () => {
    const signals = upcomingMilestoneSignals([makeMilestone({ dueDate: "2026-08-18" })], ASOF);
    expect(signals).toHaveLength(1);
    expect(signals[0].metricValue).toBe(3);
    expect(signals[0].severity).toBe("high");
  });

  it("does not flag a milestone 20 days out with the default 14-day window", () => {
    expect(upcomingMilestoneSignals([makeMilestone({ dueDate: "2026-09-04" })], ASOF)).toHaveLength(0);
  });

  it("does not double-count an overdue milestone as upcoming", () => {
    expect(upcomingMilestoneSignals([makeMilestone({ dueDate: "2026-08-14" })], ASOF)).toHaveLength(0);
  });

  it("includes a milestone due today", () => {
    const signals = upcomingMilestoneSignals([makeMilestone({ dueDate: "2026-08-15" })], ASOF);
    expect(signals).toHaveLength(1);
    expect(signals[0].metricValue).toBe(0);
  });
});

function makeProject(overrides: Partial<ProjectListItem>): ProjectListItem {
  return {
    id: "p-1",
    name: "Test Project",
    clientName: "Test Client",
    type: "Residential",
    active: true,
    hours: 0,
    totalCost: 0,
    hasUnknownRate: false,
    plannedRevenue: 10000,
    amountPaid: 0,
    outstandingBalance: 10000,
    ...overrides,
  };
}

describe("outstandingBalanceSignals", () => {
  it("ignores inactive projects", () => {
    expect(outstandingBalanceSignals([makeProject({ active: false })])).toHaveLength(0);
  });

  it("ignores trivial balances at/under the floor", () => {
    expect(outstandingBalanceSignals([makeProject({ outstandingBalance: 500 })])).toHaveLength(0);
  });

  it("scales severity with the outstanding amount", () => {
    expect(outstandingBalanceSignals([makeProject({ outstandingBalance: 1000 })])[0].severity).toBe("low");
    expect(outstandingBalanceSignals([makeProject({ outstandingBalance: 6000 })])[0].severity).toBe("medium");
    expect(outstandingBalanceSignals([makeProject({ outstandingBalance: 20000 })])[0].severity).toBe("high");
    expect(outstandingBalanceSignals([makeProject({ outstandingBalance: 50000 })])[0].severity).toBe("critical");
  });
});

function forecastRow(month: number, amount: number): RevenueRow {
  return { year: 2026, month, type: "Furniture", amount, referralSourceId: null, projectId: "p-1", projectName: "P" };
}

describe("forecastConcentrationSignal", () => {
  it("returns null when no single month dominates", () => {
    const rows = Array.from({ length: 5 }, (_, i) => forecastRow(i + 1, 1000));
    expect(forecastConcentrationSignal(rows, 2026)).toBeNull();
  });

  it("returns null when there is no forecast at all", () => {
    expect(forecastConcentrationSignal([], 2026)).toBeNull();
  });

  it("flags a month at exactly the 40% threshold", () => {
    const rows = [forecastRow(10, 3000), forecastRow(11, 4000), forecastRow(12, 3000)]; // 11 is 40% of 10000, and the max
    const signal = forecastConcentrationSignal(rows, 2026);
    expect(signal).not.toBeNull();
    expect(signal!.metricValue).toBe(40);
    expect(signal!.severity).toBe("medium");
  });

  it("escalates severity as concentration increases", () => {
    const highRows = [forecastRow(11, 5000), forecastRow(12, 5000)]; // 50/50
    expect(forecastConcentrationSignal(highRows, 2026)!.severity).toBe("high");
    const criticalRows = [forecastRow(11, 7000), forecastRow(12, 3000)]; // 70/30
    expect(forecastConcentrationSignal(criticalRows, 2026)!.severity).toBe("critical");
  });

  it("uses a stable synthetic source id across runs for the same year", () => {
    const rows = [forecastRow(11, 6000), forecastRow(12, 4000)];
    const a = forecastConcentrationSignal(rows, 2026);
    const b = forecastConcentrationSignal(rows, 2026);
    expect(a!.sourceId).toBe(b!.sourceId);
  });
});
