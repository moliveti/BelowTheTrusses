export interface ContractSummary {
  id: string;
  status: "draft" | "sent" | "signed";
}

export interface Contract {
  id: string;
  projectId: string;
  quoteId: string | null;
  templateVariant: "Residential" | "Commercial" | "Furniture";
  billingMethod: "Fixed Fee" | "Hourly" | "Commission";
  discountType: "percent" | "fixed" | null;
  discountValue: number | null;
  pmHourlyRate: number | null;
  pmEstimatedHours: number | null;
  designFeeTotal: number | null;
  payment3Amount: number | null;
  payment4Amount: number | null;
  status: "draft" | "sent" | "signed";
  pdfStoragePath: string | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}
