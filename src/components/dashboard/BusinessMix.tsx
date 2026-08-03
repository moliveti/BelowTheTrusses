"use client";

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type { RevenueRow } from "@/lib/dashboard/types";
import { PROJECT_TYPES, allTimeTotalsByType, distinctYears, ytdTotalsByType, yearlyTotalsByType } from "@/lib/dashboard/aggregate";
import { fmtUsd } from "@/lib/dashboard/format";

ChartJS.register(ArcElement, Tooltip, Legend);

const BRAND_COLORS: Record<string, string> = {
  Commercial: "#1e3a5f",
  Residential: "#5c7a63",
  Furniture: "#b8894a",
};

export type MixPeriod = "ytd" | "all" | number;

export function BusinessMix({
  rows,
  currentYear,
  currentMonth,
  period,
  onPeriodChange,
}: {
  rows: RevenueRow[];
  currentYear: number;
  currentMonth: number;
  period: MixPeriod;
  onPeriodChange: (period: MixPeriod) => void;
}) {
  const years = distinctYears(rows);

  const totals =
    period === "ytd"
      ? ytdTotalsByType(rows, currentYear, currentMonth)
      : period === "all"
        ? allTimeTotalsByType(rows)
        : yearlyTotalsByType(rows, period);

  const values = PROJECT_TYPES.map((t) => totals[t]);
  const grand = values.reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        <button
          onClick={() => onPeriodChange("ytd")}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${period === "ytd" ? "bg-brand-primary text-white" : "border border-ink text-ink"}`}
        >
          YTD
        </button>
        {years
          .filter((y) => y !== currentYear)
          .map((y) => (
            <button
              key={y}
              onClick={() => onPeriodChange(y)}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${period === y ? "bg-brand-primary text-white" : "border border-ink text-ink"}`}
            >
              {y}
            </button>
          ))}
        <button
          onClick={() => onPeriodChange("all")}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${period === "all" ? "bg-brand-primary text-white" : "border border-ink text-ink"}`}
        >
          All-time
        </button>
      </div>

      {grand === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink/50">No data for this period.</div>
      ) : (
        <div className="h-64">
          <Doughnut
            data={{
              labels: PROJECT_TYPES,
              datasets: [
                {
                  data: values,
                  backgroundColor: PROJECT_TYPES.map((t) => BRAND_COLORS[t]),
                  borderColor: "#fffdf9",
                  borderWidth: 2,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: "bottom", labels: { boxWidth: 12, font: { family: "SFMono-Regular" } } },
                tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUsd(c.parsed as number)}` } },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
