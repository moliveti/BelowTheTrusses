import { describe, expect, it } from "vitest";
import type { TimeEntry } from "@/lib/hours/types";
import { buildProjectProfitRows, profitYears, projectRevenue, totalProfitRows } from "./profitability";

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

describe("year filter", () => {
  const entries = [
    entry({ projectId: "a", subcontractorId: "amy", hours: 10, hourlyRate: 80, workDate: "2026-03-01" }),
    entry({ projectId: "a", subcontractorId: "rachel", hours: 5, hourlyRate: 70, workDate: "2027-02-01" }),
    entry({ projectId: "b", subcontractorId: "amy", hours: 4, hourlyRate: 80, workDate: "2026-06-01" }),
  ];
  const projects = [
    { id: "a", plannedRevenue: null, amountPaid: 1500, outstandingBalance: 500 },
    { id: "b", plannedRevenue: null, amountPaid: 400, outstandingBalance: 0 },
  ];
  const payments = [
    { projectId: "a", dueDate: "2025-12-01", amountDue: 800, amountPaid: 800 },
    { projectId: "a", dueDate: "2026-04-01", amountDue: 1200, amountPaid: 700 },
    { projectId: "b", dueDate: "2026-07-01", amountDue: 400, amountPaid: 400 },
  ];

  it("scopes cost to the hours worked in the year and revenue to the payments due in it", () => {
    const a = buildProjectProfitRows(entries, projects, payments, 2026).find((r) => r.projectId === "a")!;
    expect(a.hours).toBe(10);
    expect(a.cost).toBe(800);
    expect(a).toMatchObject({ total: 1200, collected: 700, notYetPaid: 500 });
    expect(a.profit).toBe(400);
  });

  it("keeps a project that has revenue due in a year but no hours that year", () => {
    const a = buildProjectProfitRows(entries, projects, payments, 2025).find((r) => r.projectId === "a")!;
    expect(a.hours).toBe(0);
    expect(a.total).toBe(800);
    expect(a.profit).toBe(800);
  });

  it("drops a project with no hours and nothing due in the year", () => {
    const rows = buildProjectProfitRows(entries, projects, payments, 2025);
    expect(rows.map((r) => r.projectId)).toEqual(["a"]);
  });

  it("only lists the contractors who worked in that year", () => {
    const a = buildProjectProfitRows(entries, projects, payments, 2027).find((r) => r.projectId === "a")!;
    expect(a.contractors.map((c) => c.id)).toEqual(["rachel"]);
  });

  it("leaves the all-time view on the project's own revenue totals", () => {
    const a = buildProjectProfitRows(entries, projects, payments, "all").find((r) => r.projectId === "a")!;
    expect(a.total).toBe(2000);
    expect(a.hours).toBe(15);
  });

  it("offers every year with hours or payments plus the current year, oldest first", () => {
    expect(profitYears(entries, payments, 2026)).toEqual([2025, 2026, 2027]);
    expect(profitYears([], [], 2026)).toEqual([2026]);
  });
});
