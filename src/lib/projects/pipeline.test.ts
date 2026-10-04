import { describe, expect, it } from "vitest";
import { isInSalesPipeline } from "./pipeline";

const tracked = new Set(["quoted-1", "sent-1", "signed-1", "legacy-1"]);

describe("isInSalesPipeline", () => {
  it("hides quoted and contract-sent projects while a lead is tracking them", () => {
    expect(isInSalesPipeline({ id: "quoted-1", status: "Quoted" }, tracked)).toBe(true);
    expect(isInSalesPipeline({ id: "sent-1", status: "Contract Sent" }, tracked)).toBe(true);
  });

  it("shows a pre-contract project that no lead is tracking, so it can't vanish", () => {
    expect(isInSalesPipeline({ id: "orphan", status: "Contract Sent" }, tracked)).toBe(false);
    expect(isInSalesPipeline({ id: "orphan", status: "Quoted" }, tracked)).toBe(false);
  });

  it("always shows projects that are under contract or predate statuses, even if a lead still points at them", () => {
    expect(isInSalesPipeline({ id: "signed-1", status: "Under Contract" }, tracked)).toBe(false);
    expect(isInSalesPipeline({ id: "legacy-1", status: null }, tracked)).toBe(false);
  });
});
