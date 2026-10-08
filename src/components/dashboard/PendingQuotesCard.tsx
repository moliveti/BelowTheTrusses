import Link from "next/link";
import type { PendingQuotes } from "@/lib/quotes/pipeline";
import { fmtUsd } from "@/lib/dashboard/format";
import { kpiCardClass } from "./KpiRow";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Quoted work that hasn't been signed or lost yet -- how many projects and what they add up to. */
export function PendingQuotesCard({ summary }: { summary: PendingQuotes }) {
  const { count, total, contractOut } = summary;
  return (
    <Link href="/?tab=leads" className={`${kpiCardClass(false)} block hover:bg-canvas`}>
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Pending Quotes</div>
      <div className="font-mono text-xl tabular-nums text-ink">{fmtUsd(total)}</div>
      <div className="mt-1.5 font-mono text-xs text-ink/60">
        {plural(count, "project")} quoted
        {contractOut.count > 0 && ` · ${contractOut.count} with contract out`}
      </div>
    </Link>
  );
}
