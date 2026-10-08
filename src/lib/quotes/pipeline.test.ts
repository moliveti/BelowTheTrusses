import { describe, expect, it } from "vitest";
import type { LeadStatus } from "@/lib/leads/types";
import { summarizePendingQuotes } from "./pipeline";

const lead = (id: string, status: LeadStatus) => ({ id, status });

describe("summarizePendingQuotes", () => {
  it("counts and totals every open lead that has a quote", () => {
    const leads = [lead("a", "Quote Sent"), lead("b", "Quote Sent"), lead("c", "New Prospect")];
    const quotes = { a: { total: 1000 }, b: { total: 2500 }, c: { total: 400 } };
    const s = summarizePendingQuotes(leads, quotes);
    expect(s.count).toBe(3);
    expect(s.total).toBe(3900);
    expect(s.awaitingDecision).toEqual({ count: 3, total: 3900 });
    expect(s.contractOut).toEqual({ count: 0, total: 0 });
  });

  it("splits out leads whose contract is already out for signature", () => {
    const leads = [lead("a", "Quote Sent"), lead("b", "Contract Submitted")];
    const s = summarizePendingQuotes(leads, { a: { total: 1000 }, b: { total: 7000 } });
    expect(s.awaitingDecision).toEqual({ count: 1, total: 1000 });
    expect(s.contractOut).toEqual({ count: 1, total: 7000 });
    expect(s.total).toBe(8000);
  });

  it("leaves out signed, lost and not-materialized leads", () => {
    const leads = [lead("a", "Signed Contract"), lead("b", "Lost"), lead("c", "Business Not Materialized")];
    const s = summarizePendingQuotes(leads, { a: { total: 1 }, b: { total: 2 }, c: { total: 3 } });
    expect(s).toMatchObject({ count: 0, total: 0 });
  });

  it("leaves out open leads that have no quote yet", () => {
    const s = summarizePendingQuotes([lead("a", "New Prospect"), lead("b", "Quote Sent")], { b: { total: 900 } });
    expect(s.count).toBe(1);
    expect(s.total).toBe(900);
  });

  it("is zero when there is nothing to count", () => {
    expect(summarizePendingQuotes([], {})).toEqual({
      count: 0,
      total: 0,
      awaitingDecision: { count: 0, total: 0 },
      contractOut: { count: 0, total: 0 },
    });
  });
});
