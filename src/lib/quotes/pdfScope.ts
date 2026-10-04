/**
 * Sections that are part of the cost build-up and the working quote, but are
 * internal -- they're left off the PDFs the client sees. Their hours still
 * count toward the totals.
 */
export const INTERNAL_SECTIONS = ["Basic Services"];

export function clientVisibleLineItems<T extends { section: string }>(items: T[]): T[] {
  return items.filter((item) => !INTERNAL_SECTIONS.includes(item.section));
}
