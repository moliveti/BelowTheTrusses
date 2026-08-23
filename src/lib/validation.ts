// A single dollar amount, e.g. "10000", "$10,000", "10k", "$10K".
const AMOUNT = /\$?\d{1,3}(,\d{3})*(\.\d+)?[kK]?/;
// The Client Budget field is a range by default ("$10k–$20k") but a single
// figure is also valid -- reject anything that isn't dollar-amount-shaped
// (e.g. "ddd") rather than force a strict two-sided range.
const BUDGET_RANGE_PATTERN = new RegExp(`^\\s*${AMOUNT.source}\\s*((-|–|to)\\s*${AMOUNT.source}\\s*)?$`);

export function isValidBudgetRange(value: string): boolean {
  return value.trim() === "" || BUDGET_RANGE_PATTERN.test(value);
}
