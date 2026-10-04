import { describe, expect, it } from "vitest";
import { clientVisibleLineItems } from "./pdfScope";

describe("clientVisibleLineItems", () => {
  it("drops Basic Services lines and keeps everything else in order", () => {
    const items = [
      { section: "Construction Documents", taskName: "Cover Sheet", amount: 200 },
      { section: "Basic Services", taskName: "Budget Development", amount: 300 },
      { section: "FFE", taskName: "Finish Selections", amount: 400 },
      { section: "Basic Services", taskName: "Contract", amount: 150 },
    ];
    expect(clientVisibleLineItems(items).map((i) => i.taskName)).toEqual(["Cover Sheet", "Finish Selections"]);
  });

  it("does not change the caller's list or any totals computed from it", () => {
    const items = [
      { section: "Basic Services", taskName: "Contract", amount: 150 },
      { section: "FFE", taskName: "Finish Selections", amount: 400 },
    ];
    clientVisibleLineItems(items);
    expect(items).toHaveLength(2);
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(550);
  });
});
