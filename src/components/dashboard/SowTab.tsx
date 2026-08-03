"use client";

import { useState } from "react";
import type { SowRow } from "@/lib/dashboard/types";
import { fmtUsd } from "@/lib/dashboard/format";

type YearKey = number | "undated";

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${m}.${day}.${y.slice(2)}`;
}

function yearOf(row: SowRow): YearKey {
  if (!row.dateSent) return "undated";
  return Number(row.dateSent.slice(0, 4));
}

export function SowTab({ rows }: { rows: SowRow[] }) {
  const years: YearKey[] = Array.from(new Set(rows.map(yearOf))).sort((a, b) => {
    if (a === "undated") return 1;
    if (b === "undated") return -1;
    return a - b;
  });

  const numericYears = years.filter((y): y is number => y !== "undated");
  const [selected, setSelected] = useState<YearKey>(numericYears[numericYears.length - 1] ?? years[0]);

  const filtered = rows.filter((r) => yearOf(r) === selected);

  const won = filtered.filter((r) => r.status === "Converted");
  const lost = filtered.filter((r) => r.status === "Declined" || r.status === "No Response");
  const decided = won.length + lost.length;
  const winRate = decided ? (won.length / decided) * 100 : null;

  const avg = (list: SowRow[]) => {
    const fees = list.map((r) => r.proposedFee).filter((f): f is number => f !== null);
    return fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : null;
  };
  const avgWon = avg(won);
  const avgLost = avg(lost);
  const totalProposed = filtered.reduce((s, r) => s + (r.proposedFee ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">SOW Sent — Did Not Materialize</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">By Year, for Win-Rate Context</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelected(y)}
            className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wide ${
              selected === y ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
            }`}
          >
            {y === "undated" ? "Undated" : y}
          </button>
        ))}
      </div>

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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-ink/50">
                  No proposals for this year.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={i} className="border-b border-line hover:bg-canvas">
                  <td className="px-3 py-2.5 text-left font-mono">{fmtDate(r.dateSent)}</td>
                  <td className="px-3 py-2.5 text-left">{r.prospectName}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {r.proposedFee ? fmtUsd(r.proposedFee) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-left">
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                        r.status === "Converted" ? "border-positive text-positive" : "border-warning text-warning"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
            {filtered.length > 0 && (
              <tr className="border-t-[1.5px] border-ink font-bold">
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-left">Total Proposed</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtUsd(totalProposed)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
