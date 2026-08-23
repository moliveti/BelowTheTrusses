// Residential scope categories — mirrors the scope_tags table seed data.
export const SCOPE_CATEGORIES = [
  "Furniture and Accessories",
  "Covered Porch",
  "Sunroom",
  "Backyard Design",
  "Kitchen Remodel",
  "Bathroom Remodel",
  "Exterior Finishes",
  "Interior Finishes",
  "Procurement Management",
  "Covered Patio",
  "Home Addition",
  "Covered Garage",
  "Permit Sets",
];

// Quote task checklist, one-to-one with the "SMART BUDGET" tab of the
// owner's real budgeting spreadsheet: fixed task names and default hourly
// rate per section, hours left at 0 for the owner to fill in per quote (the
// spreadsheet ships with the same blank-hours checklist). "Finish
// Selections" hours are not typed directly -- they're the live sum of the
// selection_catalog checklist (see quote_selections).
export type QuoteSection = "Construction Documents" | "Renderings & Presentations" | "FFE" | "Construction Administration" | "Basic Services";

export interface QuoteTaskDefault {
  section: QuoteSection;
  taskName: string;
  rate: number;
}

export const QUOTE_TASK_CATALOG: QuoteTaskDefault[] = [
  { section: "Construction Documents", taskName: "Field Verification", rate: 200 },
  { section: "Construction Documents", taskName: "Field Input", rate: 200 },
  { section: "Construction Documents", taskName: "CD Production", rate: 200 },
  { section: "Construction Documents", taskName: "Director Review", rate: 200 },
  { section: "Construction Documents", taskName: "Redlines", rate: 200 },
  { section: "Construction Documents", taskName: "CD Review Meeting with Client", rate: 200 },
  { section: "Construction Documents", taskName: "1 Revision Included After Page Turn", rate: 200 },
  { section: "Construction Documents", taskName: "1 Revision Before Released for Construction", rate: 200 },
  { section: "Construction Documents", taskName: "Issue Construction Documents", rate: 200 },
  { section: "Construction Documents", taskName: "Assemble and Transmit CDs to Engineers", rate: 200 },
  { section: "Renderings & Presentations", taskName: "Renderings", rate: 200 },
  { section: "Renderings & Presentations", taskName: "Initial Design Package", rate: 200 },
  { section: "Renderings & Presentations", taskName: "Revised Design Package", rate: 200 },
  { section: "FFE", taskName: "Finish Selections", rate: 200 },
  { section: "FFE", taskName: "Finish Meeting (if not included above)", rate: 200 },
  { section: "FFE", taskName: "Order and Transmit Samples", rate: 200 },
  { section: "Construction Administration", taskName: "Contractor Coordination/RFIs", rate: 200 },
  { section: "Construction Administration", taskName: "Shop Drawing Review", rate: 200 },
  { section: "Construction Administration", taskName: "Site Visits", rate: 150 },
  { section: "Construction Administration", taskName: "Punch List", rate: 150 },
  { section: "Construction Administration", taskName: "Scan Punch List, Transmit, Email Coordination", rate: 150 },
  { section: "Basic Services", taskName: "Budget Development", rate: 150 },
  { section: "Basic Services", taskName: "Contract", rate: 150 },
];
