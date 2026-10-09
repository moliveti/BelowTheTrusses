import { describe, expect, it } from "vitest";
import { QUOTE_TASK_CATALOG } from "./scope";

describe("QUOTE_TASK_CATALOG", () => {
  it("opens Construction Documents with Field Verification, Field Input, then Floor Plan Options", () => {
    const names = QUOTE_TASK_CATALOG.filter((t) => t.section === "Construction Documents").map((t) => t.taskName);
    expect(names.slice(0, 3)).toEqual(["Field Verification", "Field Input", "Floor Plan Options"]);
  });

  it("lists each task once per section", () => {
    const keys = QUOTE_TASK_CATALOG.map((t) => `${t.section}::${t.taskName}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
