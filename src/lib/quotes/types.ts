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

export interface SelectionCatalogItem {
  id: string;
  category: string;
  itemName: string;
  defaultHours: number;
  sequenceOrder: number;
}
