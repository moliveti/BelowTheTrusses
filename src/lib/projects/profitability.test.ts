import { describe, expect, it } from "vitest";
import type { TimeEntry } from "@/lib/hours/types";
import { buildProjectProfitRows, projectRevenue, totalProfitRows } from "./profitability";

function entry(over: Partial<TimeEntry> & Pick<TimeEntry, "projectId" | "subcontractorId" | "hours">): TimeEntry {
  return {
    id: Math.random().toString(36).slice(2),
    subcontractorName: over.subcontractorId.toUpperCase(),
    projectName: over.projectId.toUpperCase(),
    workDate: "2026-03-01",
    workDescription: "",
    hourlyRate: 80,
    paidAt: null,
    createdAt: "2026-03-01T00:00:00Z",
    ...over,
  };
}

describe("projectRevenue", () => {
  it("adds collected and not-yet-paid from the payment schedule to get total revenue", () => {
    const r = projectRevenue({ id: "p", plannedRevenue: null, amountPaid: 1000, outstandingBalance: 500 });
    expect(r).toEqual({ contractValue: null, collected: 1000, notYetPaid: 500, total: 1500 });
  });

  it("keeps the contract value in its own field without letting it override the schedule", () => {
    const r = projectRevenue({ id: "p", plannedRevenue: 2000, amountPaid: 300, outstandingBalance: 1200 });
    expect(r.contractValue).toBe(2000);
    expect(r.total).toBe(1500);
  });

  it("falls back to the contract value when there is no payment schedule yet", () => {
    const r = projectRevenue({ id: "p", plannedRevenue: 1600, amountPaid: 0, outstandingBalance: 0 });
    expect(r).toEqual({ contractValue: 1600, collected: 0, notYetPaid: 1600, total: 1600 });
  });

  it("is all zero when nothing is known about the project", () => {
    expect(projectRevenue(undefined)).toEqual({ contractValue: null, collected: 0, notYetPaid: 0, total: 0 });
  });

  it("never reports a negative not-yet-paid when a project is overpaid", () => {
    const r = projectRevenue({ id: "p", plannedRevenue: null, amountPaid: 1200, outstandingBalance: -200 });
    expect(r.notYetPaid).toBe(0);
  });
});

describe("buildProjectProfitRows", () => {
  const entries = [
    entry({ projectId: "a", subcontractorId: "amy", hours: 10, hourlyRate: 80 }),
    entry({ projectId: "a", subcontractorId: "rachel", hours: 5, hourlyRate: 70 }),
    entry({ projectId: "a", subcontractorId: "amy", hours: 2, hourlyRate: 80 }),
    entry({ projectId: "b", subcontractorId: "rachel", hours: 4, hourlyRate: 70 }),
  ];
  const projects = [
    { id: "a", plannedRevenue: null, amountPaid: 1000, outstandingBalance: 500 },
    { id: "b", plannedRevenue: null, amountPaid: 0, outstandingBalance: 0 },
  ];

  it("joins each project's cost to its revenue and computes profit", () => {
    const rows = buildProjectProfitRows(entries, projects);
    const a = rows.find((r) => r.projectId === "a")!;
    expect(a.hours).toBe(17);
    expect(a.cost).toBe(12 * 80 + 5 * 70); // 1310
    expect(a.total).toBe(1500);
    expect(a.profit).toBe(1500 - 1310);
  });

  it("breaks each project's hours and dollars out per contractor", () => {
    const a = buildProjectProfitRows(entries, projects).find((r) => r.projectId === "a")!;
    const amy = a.contractors.find((c) => c.id === "amy")!;
    const rachel = a.contractors.find((c) => c.id === "rachel")!;
    expect(amy).toMatchObject({ hours: 12, cost: 960, avgRate: 80 });
    expect(rachel).toMatchObject({ hours: 5, cost: 350, avgRate: 70 });
  });

  it("shows a project with hours but no revenue as a loss rather than hiding its cost", () => {
    const b = buildProjectProfitRows(entries, projects).find((r) => r.projectId === "b")!;
    expect(b.total).toBe(0);
    expect(b.profit).toBe(-280);
  });

  it("totals so that profit always equals total revenue minus total cost", () => {
    const totals = totalProfitRows(buildProjectProfitRows(entries, projects));
    expect(totals.profit).toBe(totals.total - totals.cost);
    expect(totals.hours).toBe(21);
  });
});
