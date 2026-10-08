export interface QuoteLineItem {
  id: string;
  section: string;
  taskName: string;
  hours: number;
  rate: number;
  amount: number;
  sequenceOrder: number;
}

export interface QuoteSelection {
  id: string;
  catalogItemId: string;
  category: string;
  itemName: string;
  qty: number;
  hours: number;
}

export interface Quote {
  id: string;
  leadId: string;
  projectId: string;
  projectType: string;
  status: "draft" | "sent" | "accepted" | "superseded";
  discountType: "percent" | "fixed" | null;
  discountValue: number | null;
  pmHourlyRate: number | null;
  pmEstimatedHours: number | null;
  subtotal: number;
  total: number;
  pdfStoragePath: string | null;
  createdAt: string;
  lineItems: QuoteLineItem[];
  selections: QuoteSelection[];
}

/** A lead's most recent quote -- enough to link its PDF and show what was quoted. */
export interface LatestQuote {
  id: string;
  total: number;
}

export interface SelectionCatalogItem {
  id: string;
  category: string;
  itemName: string;
  defaultHours: number;
  sequenceOrder: number;
}
