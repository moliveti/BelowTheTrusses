import { describe, expect, it } from "vitest";
import { QUOTE_TASK_CATALOG } from "./scope";

describe("QUOTE_TASK_CATALOG", () => {
  it("offers Floor Plan Options in Construction Documents, right after Field Verification", () => {
    const names = QUOTE_TASK_CATALOG.filter((t) => t.section === "Construction Documents").map((t) => t.taskName);
    expect(names.indexOf("Floor Plan Options")).toBe(names.indexOf("Field Verification") + 1);
  });

  it("lists each task once per section", () => {
    const keys = QUOTE_TASK_CATALOG.map((t) => `${t.section}::${t.taskName}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
