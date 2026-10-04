import type { QuoteTaskDefault } from "@/lib/scope";

export interface DraftLineItem {
  section: string;
  taskName: string;
  hours: string;
  rate: string;
}

export interface StoredLineItem {
  section: string;
  taskName: string;
  hours: number;
  rate: number;
}

/** A quote can be changed until it's accepted -- generating a contract is what accepts it. */
export const EDITABLE_QUOTE_STATUSES = ["draft", "sent"];

const keyOf = (section: string, taskName: string) => `${section}::${taskName}`;

/**
 * Rebuilds the builder's task checklist for an existing quote: every task in
 * today's catalog (blank unless the quote has hours/rate for it), followed by
 * any stored task the catalog no longer lists -- so a quote built before a
 * task was renamed or split doesn't silently lose that line on its next save.
 * `computedTask` is the line the builder derives from the finish selections
 * rather than typing in, so it's left out here.
 */
export function mergeLineItems(catalog: QuoteTaskDefault[], stored: StoredLineItem[], computedTask: string): DraftLineItem[] {
  const remaining = new Map(stored.map((s) => [keyOf(s.section, s.taskName), s]));

  const fromCatalog = catalog
    .filter((t) => t.taskName !== computedTask)
    .map((t) => {
      const key = keyOf(t.section, t.taskName);
      const match = remaining.get(key);
      remaining.delete(key);
      return {
        section: t.section,
        taskName: t.taskName,
        hours: match ? String(match.hours) : "",
        rate: match ? String(match.rate) : String(t.rate),
      };
    });

  const orphaned = Array.from(remaining.values())
    .filter((s) => s.taskName !== computedTask)
    .map((s) => ({ section: s.section, taskName: s.taskName, hours: String(s.hours), rate: String(s.rate) }));

  return [...fromCatalog, ...orphaned];
}
