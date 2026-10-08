import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { LatestQuote } from "./types";

/** Leads that are neither signed nor closed out, so whatever was quoted to them is still in play. */
export const OPEN_LEAD_STATUSES: LeadStatus[] = ["New Prospect", "Quote Sent", "Contract Submitted"];

export interface PendingQuoteGroup {
  count: number;
  total: number;
}

export interface PendingQuotes extends PendingQuoteGroup {
  /** Quote is out and the client hasn't said yes. */
  awaitingDecision: PendingQuoteGroup;
  /** Client said yes and the contract is out for signature. */
  contractOut: PendingQuoteGroup;
}

/**
 * Quoted work that hasn't been signed or lost yet: one entry per lead that has
 * a quote and is still open. The quote total includes the internal Basic
 * Services line, same as the quote itself.
 */
export function summarizePendingQuotes(
  leads: Pick<Lead, "id" | "status">[],
  quotesByLeadId: Record<string, Pick<LatestQuote, "total">>
): PendingQuotes {
  const awaitingDecision = { count: 0, total: 0 };
  const contractOut = { count: 0, total: 0 };

  for (const lead of leads) {
    const quote = quotesByLeadId[lead.id];
    if (!quote || !OPEN_LEAD_STATUSES.includes(lead.status)) continue;
    const group = lead.status === "Contract Submitted" ? contractOut : awaitingDecision;
    group.count += 1;
    group.total += quote.total;
  }

  return {
    count: awaitingDecision.count + contractOut.count,
    total: awaitingDecision.total + contractOut.total,
    awaitingDecision,
    contractOut,
  };
}
