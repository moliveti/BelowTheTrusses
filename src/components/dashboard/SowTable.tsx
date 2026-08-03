"use client";

import type { SowRow } from "@/lib/dashboard/types";
import { fmtUsd } from "@/lib/dashboard/format";

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${m}.${day}.${y.slice(2)}`;
}

export function SowTable({ rows }: { rows: SowRow[] }) {
  const won = rows.filter((r) => r.status === "Converted");
  const lost = rows.filter((r) => r.status === "Declined" || r.status === "No Response");
  const decided = won.length + lost.length;
  const winRate = decided ? (won.length / decided) * 100 : null;

  const avg = (list: SowRow[]) => {
    const fees = list.map((r) => r.proposedFee).filter((f): f is number => f !== null);
    return fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : null;
  };
  const avgWon = avg(won);
  const avgLost = avg(lost);

  const totalProposed = rows.reduce((s, r) => s + (r.proposedFee ?? 0), 0);

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="border border-line bg-surface p-4">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Win Rate</div>
          <div className="font-mono text-lg tabular-nums text-ink">
            {winRate === null ? "—" : `${winRate.toFixed(0)}%`}
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink/50">
            {won.length} won / {decided} decided
          </div>
        </div>
        <div className="border border-line bg-surface p-4">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Avg. Won Fee</div>
          <div className="font-mono text-lg tabular-nums text-ink">{avgWon === null ? "—" : fmtUsd(avgWon)}</div>
        </div>
        <div className="border border-line bg-surface p-4">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Avg. Lost Fee</div>
          <div className="font-mono text-lg tabular-nums text-ink">{avgLost === null ? "—" : fmtUsd(avgLost)}</div>
        </div>
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Date</th>
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Prospect</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Proposed Fee</th>
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line hover:bg-canvas">
                <td className="px-3 py-2.5 text-left font-mono">{fmtDate(r.dateSent)}</td>
                <td className="px-3 py-2.5 text-left">{r.prospectName}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {r.proposedFee ? fmtUsd(r.proposedFee) : "—"}
                </td>
                <td className="px-3 py-2.5 text-left">
                  <span
                    className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                      r.status === "Converted"
                        ? "border-positive text-positive"
                        : "border-warning text-warning"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            <tr className="border-t-[1.5px] border-ink font-bold">
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-left">Total Proposed</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtUsd(totalProposed)}</td>
              <td className="px-3 py-2.5" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
