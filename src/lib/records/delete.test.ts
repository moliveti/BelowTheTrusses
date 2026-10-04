import { describe, expect, it } from "vitest";
import { describeDeletion, isQuotePlaceholder, projectBlockers, type ProjectImpact } from "./delete";

const base: ProjectImpact = {
  id: "p1",
  name: "Kelley Taylor",
  status: "Quoted",
  timeEntryCount: 0,
  paymentCount: 0,
  milestoneCount: 0,
  allocationCount: 0,
  quoteIds: ["q1"],
  contracts: [],
};

describe("isQuotePlaceholder", () => {
  it("is true for a Quoted project with nothing attached", () => {
    expect(isQuotePlaceholder(base)).toBe(true);
  });

  it("is false once a contract exists, even an unsigned draft", () => {
    expect(isQuotePlaceholder({ ...base, contracts: [{ id: "c1", signed: false }] })).toBe(false);
  });

  it("is false once the project has moved past Quoted", () => {
    expect(isQuotePlaceholder({ ...base, status: "Contract Sent" })).toBe(false);
    expect(isQuotePlaceholder({ ...base, status: "Under Contract" })).toBe(false);
  });

  it("is false when contractor hours or payments are recorded", () => {
    expect(isQuotePlaceholder({ ...base, timeEntryCount: 1 })).toBe(false);
    expect(isQuotePlaceholder({ ...base, paymentCount: 1 })).toBe(false);
  });
});

describe("projectBlockers", () => {
  it("is empty for a bare project", () => {
    expect(projectBlockers(base)).toEqual([]);
  });

  it("lists hours, payments and signed contracts, but not unsigned drafts", () => {
    const reasons = projectBlockers({
      ...base,
      timeEntryCount: 2,
      paymentCount: 1,
      contracts: [
        { id: "c1", signed: true },
        { id: "c2", signed: false },
      ],
    });
    expect(reasons).toEqual(["2 contractor time entries logged", "1 payment recorded", "1 signed contract"]);
  });
});

describe("describeDeletion", () => {
  it("reports what was removed and what was kept", () => {
    const message = describeDeletion('Deleted lead "Kelley Taylor"', {
      quotesDeleted: 1,
      projectsDeleted: [],
      projectsKept: [{ name: "Kelley Taylor", reasons: ["has a contract"] }],
      sowDeleted: true,
      leadReset: false,
    });
    expect(message).toBe(
      'Deleted lead "Kelley Taylor" — removed 1 quote, removed its open proposal. Project "Kelley Taylor" was kept (has a contract).'
    );
  });

  it("mentions the quote-stage project and the lead reset when a quote is deleted on its own", () => {
    const message = describeDeletion('Deleted quote for "Leslie Lynn"', {
      quotesDeleted: 2,
      projectsDeleted: ["Leslie Lynn"],
      projectsKept: [],
      sowDeleted: false,
      leadReset: true,
    });
    expect(message).toBe(
      'Deleted quote for "Leslie Lynn" — removed 2 quotes, removed the quote-stage project "Leslie Lynn", lead is back to New Prospect.'
    );
  });
});
