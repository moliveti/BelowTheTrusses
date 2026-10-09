import { describe, expect, it } from "vitest";
import type { SubcontractorRates } from "@/lib/hours/types";
import {
  assignmentInsertRows,
  defaultPaymentName,
  paymentInsertRows,
  projectInsertRow,
  validateNewCommercial,
  type NewCommercialDraft,
} from "./newCommercial";

const draft = (over: Partial<NewCommercialDraft> = {}): NewCommercialDraft => ({
  clientName: "Carrollton Office Equipment",
  projectName: "COE_Test Building",
  state: "FL",
  signedDate: "2026-10-09",
  billingMethod: "Hourly",
  hourlyRate: "",
  fixedFee: "",
  contractValue: "",
  payments: [],
  contractors: [],
  ...over,
});

const rates: SubcontractorRates[] = [
  { id: "rachel", name: "Rachel", defaultHourlyRate: 70, typeRates: { Commercial: 80 } },
  { id: "lee", name: "Lee", defaultHourlyRate: 65, typeRates: {} },
];

describe("validateNewCommercial", () => {
  it("accepts a draft with just a client, name and state", () => {
    expect(validateNewCommercial(draft())).toBeNull();
  });

  it("asks for the client, name and state first", () => {
    expect(validateNewCommercial(draft({ clientName: " " }))).toMatch(/client/i);
    expect(validateNewCommercial(draft({ projectName: "" }))).toMatch(/project name/i);
    expect(validateNewCommercial(draft({ state: "" }))).toMatch(/state/i);
  });

  it("only checks the rate that applies to the billing method", () => {
    expect(validateNewCommercial(draft({ billingMethod: "Fixed Fee", hourlyRate: "abc" }))).toBeNull();
    expect(validateNewCommercial(draft({ billingMethod: "Hourly", hourlyRate: "-5" }))).toMatch(/hourly rate/i);
  });

  it("needs a due date and an amount on every payment", () => {
    expect(validateNewCommercial(draft({ payments: [{ name: "", dueDate: "", amount: "100" }] }))).toMatch(/due date/);
    expect(validateNewCommercial(draft({ payments: [{ name: "", dueDate: "2026-11-01", amount: "" }] }))).toMatch(/amount/);
  });

  it("rejects two payments that would share a name and due date", () => {
    const p = { name: "", dueDate: "2026-11-01", amount: "100" };
    expect(validateNewCommercial(draft({ payments: [p, { ...p, amount: "200" }] }))).toMatch(/Nov 2026 Payment/);
  });

  it("rejects an empty or repeated contractor and bad hours", () => {
    expect(validateNewCommercial(draft({ contractors: [{ subcontractorId: "", allocatedHours: "", hourlyRate: "" }] }))).toMatch(/pick who/);
    const c = { subcontractorId: "rachel", allocatedHours: "", hourlyRate: "" };
    expect(validateNewCommercial(draft({ contractors: [c, c] }))).toMatch(/twice/);
    expect(validateNewCommercial(draft({ contractors: [{ ...c, allocatedHours: "0" }] }))).toMatch(/more than zero/);
  });
});

describe("projectInsertRow", () => {
  it("starts active and under contract as a Commercial project", () => {
    const row = projectInsertRow(draft(), "client-1");
    expect(row).toMatchObject({ client_id: "client-1", type: "Commercial", status: "Under Contract", active: true, state: "FL" });
  });

  it("keeps only the rate that matches the billing method", () => {
    const hourly = projectInsertRow(draft({ billingMethod: "Hourly", hourlyRate: "150", fixedFee: "9000" }), "c");
    expect(hourly).toMatchObject({ hourly_rate: 150, fixed_fee_amount: null });
    const fixed = projectInsertRow(draft({ billingMethod: "Fixed Fee", hourlyRate: "150", fixedFee: "9000" }), "c");
    expect(fixed).toMatchObject({ hourly_rate: null, fixed_fee_amount: 9000 });
  });

  it("saves blank optional numbers as null and trims the name", () => {
    const row = projectInsertRow(draft({ projectName: "  COE_Test  ", contractValue: "" }), "c");
    expect(row.name).toBe("COE_Test");
    expect(row.contract_value).toBeNull();
  });
});

describe("paymentInsertRows", () => {
  it("names a blank payment after its month, like the existing schedules", () => {
    expect(defaultPaymentName("2026-06-15")).toBe("Jun 2026 Payment");
    const rows = paymentInsertRows("p1", [
      { name: "", dueDate: "2026-06-15", amount: "1000" },
      { name: "Deposit", dueDate: "2026-07-01", amount: "500" },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Jun 2026 Payment", "Deposit"]);
    expect(rows.map((r) => r.sequence_order)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ project_id: "p1", amount_due: 1000, status: "Pending" });
  });
});

describe("assignmentInsertRows", () => {
  it("uses the typed rate, else the contractor's Commercial rate, else their default", () => {
    const rows = assignmentInsertRows(
      "p1",
      [
        { subcontractorId: "rachel", allocatedHours: "40", hourlyRate: "95" },
        { subcontractorId: "rachel", allocatedHours: "", hourlyRate: "" },
        { subcontractorId: "lee", allocatedHours: "10", hourlyRate: "" },
      ],
      rates
    );
    expect(rows.map((r) => r.hourly_rate)).toEqual([95, 80, 65]);
    expect(rows.map((r) => r.allocated_hours)).toEqual([40, null, 10]);
  });
});
