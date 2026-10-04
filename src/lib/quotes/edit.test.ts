import { describe, expect, it } from "vitest";
import type { QuoteTaskDefault } from "@/lib/scope";
import { EDITABLE_QUOTE_STATUSES, mergeLineItems } from "./edit";

const catalog: QuoteTaskDefault[] = [
  { section: "Construction Documents", taskName: "Cover Sheet", rate: 200 },
  { section: "FFE", taskName: "Finish Selections", rate: 200 },
  { section: "Basic Services", taskName: "Budget Development", rate: 150 },
];

describe("mergeLineItems", () => {
  it("lists the whole catalog blank for a quote with nothing stored, minus the computed line", () => {
    expect(mergeLineItems(catalog, [], "Finish Selections")).toEqual([
      { section: "Construction Documents", taskName: "Cover Sheet", hours: "", rate: "200" },
      { section: "Basic Services", taskName: "Budget Development", hours: "", rate: "150" },
    ]);
  });

  it("fills in stored hours and the stored rate, not the catalog default", () => {
    const merged = mergeLineItems(
      catalog,
      [
        { section: "Construction Documents", taskName: "Cover Sheet", hours: 3.5, rate: 225 },
        { section: "Basic Services", taskName: "Budget Development", hours: 2, rate: 150 },
      ],
      "Finish Selections"
    );
    expect(merged[0]).toMatchObject({ taskName: "Cover Sheet", hours: "3.5", rate: "225" });
    expect(merged[1]).toMatchObject({ taskName: "Budget Development", hours: "2", rate: "150" });
  });

  it("keeps a stored task the catalog no longer has, so its hours aren't dropped on save", () => {
    const merged = mergeLineItems(
      catalog,
      [{ section: "Construction Documents", taskName: "CD Production", hours: 12, rate: 200 }],
      "Finish Selections"
    );
    expect(merged[merged.length - 1]).toEqual({
      section: "Construction Documents",
      taskName: "CD Production",
      hours: "12",
      rate: "200",
    });
  });

  it("never returns the finish-selections line, which is recomputed from the selections", () => {
    const merged = mergeLineItems(catalog, [{ section: "FFE", taskName: "Finish Selections", hours: 4, rate: 200 }], "Finish Selections");
    expect(merged.some((m) => m.taskName === "Finish Selections")).toBe(false);
  });
});

describe("EDITABLE_QUOTE_STATUSES", () => {
  it("allows draft and sent but not accepted or superseded", () => {
    expect(EDITABLE_QUOTE_STATUSES).toContain("draft");
    expect(EDITABLE_QUOTE_STATUSES).toContain("sent");
    expect(EDITABLE_QUOTE_STATUSES).not.toContain("accepted");
    expect(EDITABLE_QUOTE_STATUSES).not.toContain("superseded");
  });
});
