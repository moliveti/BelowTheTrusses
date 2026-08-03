"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { RevenueRow } from "@/lib/dashboard/types";
import { distinctYears, monthlyTotalsForYear } from "@/lib/dashboard/aggregate";
import { fmtUsd, fmtUsdCompact, MONTH_LABELS } from "@/lib/dashboard/format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const NEUTRAL_COLORS = ["#9aa5ad", "#5c7a63", "#8a7a5f", "#6b7d99"];

export function YoyChart({ rows, currentYear }: { rows: RevenueRow[]; currentYear: number }) {
  const years = distinctYears(rows);

  if (years.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center border border-line bg-surface text-sm text-ink/50">
        No data for this view yet.
      </div>
    );
  }

  const datasets = years.map((year, i) => {
    const isCurrent = year === currentYear;
    return {
      label: String(year),
      data: monthlyTotalsForYear(rows, year),
      borderColor: isCurrent ? "#b8894a" : NEUTRAL_COLORS[i % NEUTRAL_COLORS.length],
      backgroundColor: isCurrent ? "rgba(184,137,74,0.08)" : "transparent",
      borderWidth: isCurrent ? 2.5 : 2,
      tension: 0.25,
      pointRadius: 2,
      fill: isCurrent,
    };
  });

  return (
    <div className="h-80 border border-line bg-surface p-5">
      <Line
        data={{ labels: MONTH_LABELS, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { boxWidth: 12, font: { family: "SFMono-Regular" } } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtUsd(c.parsed.y as number)}` } },
          },
          scales: {
            y: {
              ticks: { callback: (v) => fmtUsdCompact(Number(v)), font: { family: "SFMono-Regular", size: 10.5 } },
              grid: { color: "rgba(30,58,95,0.08)" },
            },
            x: { ticks: { font: { family: "SFMono-Regular", size: 10.5 } }, grid: { display: false } },
          },
        }}
      />
    </div>
  );
}
