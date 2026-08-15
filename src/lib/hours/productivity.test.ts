import { describe, expect, it } from "vitest";
import { costByContractor, costByMonth, costByProject } from "./productivity";
import type { TimeEntry } from "./types";

function makeEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: "te-1",
    subcontractorId: "sub-1",
    subcontractorName: "Rachel Roberts",
    projectId: "proj-1",
    projectName: "Test Project",
    workDate: "2026-08-11",
    hours: 4,
    workDescription: "Plans",
    hourlyRate: 80,
    paidAt: null,
    ...overrides,
  };
}

describe("costByProject", () => {
  it("sums hours and cost per project across contractors", () => {
    const entries = [
      makeEntry({ id: "1", projectId: "p1", projectName: "Project A", hours: 4, hourlyRate: 80 }),
      makeEntry({ id: "2", projectId: "p1", projectName: "Project A", subcontractorId: "sub-2", hours: 3, hourlyRate: 100 }),
      makeEntry({ id: "3", projectId: "p2", projectName: "Project B", hours: 2, hourlyRate: 80 }),
    ];
    const rows = costByProject(entries);
    const projectA = rows.find((r) => r.id === "p1")!;
    expect(projectA.hours).toBe(7);
    expect(projectA.cost).toBe(4 * 80 + 3 * 100);
  });

  it("computes the effective blended avg rate, not the nominal rate", () => {
    const entries = [
      makeEntry({ id: "1", projectId: "p1", hours: 4, hourlyRate: 80 }),
      makeEntry({ id: "2", projectId: "p1", hours: 4, hourlyRate: 120 }),
    ];
    const rows = costByProject(entries);
    expect(rows[0].avgRate).toBe(100); // (4*80 + 4*120) / 8
  });

  it("flags unknown rates without silently zeroing out the cost", () => {
    const entries = [makeEntry({ hours: 4, hourlyRate: null })];
    const rows = costByProject(entries);
    expect(rows[0].hasUnknownRate).toBe(true);
    expect(rows[0].cost).toBe(0);
  });

  it("sorts by cost descending", () => {
    const entries = [
      makeEntry({ id: "1", projectId: "p1", projectName: "Small", hours: 1, hourlyRate: 80 }),
      makeEntry({ id: "2", projectId: "p2", projectName: "Big", hours: 10, hourlyRate: 80 }),
    ];
    const rows = costByProject(entries);
    expect(rows[0].id).toBe("p2");
  });
});

describe("costByContractor", () => {
  it("sums across projects for the same contractor", () => {
    const entries = [
      makeEntry({ id: "1", subcontractorId: "s1", subcontractorName: "Rachel", projectId: "p1", hours: 4, hourlyRate: 80 }),
      makeEntry({ id: "2", subcontractorId: "s1", subcontractorName: "Rachel", projectId: "p2", hours: 3, hourlyRate: 80 }),
    ];
    const rows = costByContractor(entries);
    expect(rows).toHaveLength(1);
    expect(rows[0].hours).toBe(7);
  });
});

describe("costByMonth", () => {
  it("groups by calendar year+month regardless of project/contractor", () => {
    const entries = [
      makeEntry({ id: "1", workDate: "2026-08-05", hours: 2, hourlyRate: 80 }),
      makeEntry({ id: "2", workDate: "2026-08-20", subcontractorId: "s2", hours: 3, hourlyRate: 100 }),
      makeEntry({ id: "3", workDate: "2026-09-01", hours: 1, hourlyRate: 80 }),
    ];
    const rows = costByMonth(entries);
    expect(rows).toHaveLength(2);
    const aug = rows.find((r) => r.month === 8)!;
    expect(aug.hours).toBe(5);
    expect(aug.cost).toBe(2 * 80 + 3 * 100);
  });

  it("sorts chronologically", () => {
    const entries = [
      makeEntry({ id: "1", workDate: "2026-09-01" }),
      makeEntry({ id: "2", workDate: "2026-08-01" }),
      makeEntry({ id: "3", workDate: "2025-12-01" }),
    ];
    const rows = costByMonth(entries);
    expect(rows.map((r) => `${r.year}-${r.month}`)).toEqual(["2025-12", "2026-8", "2026-9"]);
  });
});
