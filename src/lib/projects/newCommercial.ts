import type { SubcontractorRates } from "@/lib/hours/types";
import { effectiveRate } from "@/lib/hours/rates";
import { MONTH_LABELS } from "@/lib/dashboard/format";

/** Commercial work is billed by the hour or for a fixed fee; Commission is a furniture arrangement. */
export const COMMERCIAL_BILLING_METHODS = ["Hourly", "Fixed Fee"] as const;
export type CommercialBilling = (typeof COMMERCIAL_BILLING_METHODS)[number];

export interface DraftPayment {
  name: string;
  dueDate: string;
  amount: string;
}

export interface DraftContractor {
  subcontractorId: string;
  allocatedHours: string;
  hourlyRate: string;
}

export interface NewCommercialDraft {
  clientName: string;
  projectName: string;
  state: string;
  signedDate: string;
  billingMethod: CommercialBilling;
  hourlyRate: string;
  fixedFee: string;
  contractValue: string;
  payments: DraftPayment[];
  contractors: DraftContractor[];
}

const toNumber = (s: string): number | null => (s.trim() === "" ? null : Number(s));
const isAmount = (s: string) => s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;

/** "Jun 2026 Payment" -- the name the existing commercial payment schedules use. */
export function defaultPaymentName(dueDate: string): string {
  const [year, month] = dueDate.split("-");
  return `${MONTH_LABELS[Number(month) - 1] ?? ""} ${year} Payment`.trim();
}

const paymentName = (p: DraftPayment) => p.name.trim() || defaultPaymentName(p.dueDate);

/** First problem with the draft, in the order the form is filled in, or null when it can be saved. */
export function validateNewCommercial(d: NewCommercialDraft): string | null {
  if (!d.clientName.trim()) return "Pick a client or enter a new client name.";
  if (!d.projectName.trim()) return "Project name is required.";
  if (!d.state) return "State is required.";

  if (d.billingMethod === "Hourly" && d.hourlyRate.trim() !== "" && !isAmount(d.hourlyRate)) {
    return "Hourly rate must be a number, zero or more.";
  }
  if (d.billingMethod === "Fixed Fee" && d.fixedFee.trim() !== "" && !isAmount(d.fixedFee)) {
    return "Fixed fee must be a number, zero or more.";
  }
  if (d.contractValue.trim() !== "" && !isAmount(d.contractValue)) {
    return "Contract value must be a number, zero or more.";
  }

  const seenPayments = new Set<string>();
  for (const [i, p] of d.payments.entries()) {
    if (!p.dueDate) return `Payment ${i + 1} needs a due date.`;
    if (!isAmount(p.amount)) return `Payment ${i + 1} needs an amount (a number, zero or more).`;
    const key = `${paymentName(p)}::${p.dueDate}`;
    if (seenPayments.has(key)) {
      return `Two payments are named "${paymentName(p)}" on ${p.dueDate}. Change the name or the date of one.`;
    }
    seenPayments.add(key);
  }

  const seenContractors = new Set<string>();
  for (const [i, c] of d.contractors.entries()) {
    if (!c.subcontractorId) return `Contractor ${i + 1}: pick who it is, or remove the row.`;
    if (seenContractors.has(c.subcontractorId)) return "The same contractor is listed twice.";
    seenContractors.add(c.subcontractorId);
    if (c.allocatedHours.trim() !== "" && !(Number(c.allocatedHours) > 0)) {
      return `Contractor ${i + 1}: allocated hours must be more than zero.`;
    }
    if (c.hourlyRate.trim() !== "" && !isAmount(c.hourlyRate)) {
      return `Contractor ${i + 1}: rate must be a number, zero or more.`;
    }
  }
  return null;
}

/** The projects row. Commercial work skips the quote and contract steps, so it starts active and under contract. */
export function projectInsertRow(d: NewCommercialDraft, clientId: string) {
  return {
    client_id: clientId,
    name: d.projectName.trim(),
    type: "Commercial" as const,
    state: d.state,
    contract_signed_date: d.signedDate || null,
    contract_value: toNumber(d.contractValue),
    billing_method: d.billingMethod,
    hourly_rate: d.billingMethod === "Hourly" ? toNumber(d.hourlyRate) : null,
    fixed_fee_amount: d.billingMethod === "Fixed Fee" ? toNumber(d.fixedFee) : null,
    active: true,
    status: "Under Contract" as const,
  };
}

export function paymentInsertRows(projectId: string, payments: DraftPayment[]) {
  return payments.map((p, i) => ({
    project_id: projectId,
    name: paymentName(p),
    sequence_order: i + 1,
    due_date: p.dueDate,
    amount_due: Number(p.amount),
    status: "Pending" as const,
  }));
}

/**
 * One project_subcontractors row per contractor. A blank rate falls back to the
 * contractor's Commercial (or default) rate, the same as assigning them from
 * the Timesheets tab, so cost reporting has a rate to work with.
 */
export function assignmentInsertRows(projectId: string, contractors: DraftContractor[], rates: SubcontractorRates[]) {
  return contractors.map((c) => ({
    project_id: projectId,
    subcontractor_id: c.subcontractorId,
    hourly_rate: toNumber(c.hourlyRate) ?? effectiveRate(rates.find((r) => r.id === c.subcontractorId), "Commercial"),
    allocated_hours: toNumber(c.allocatedHours),
  }));
}
