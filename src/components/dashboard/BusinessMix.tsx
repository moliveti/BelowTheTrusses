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
    <div className="border border-line border-t-2 border-t-brand-accent bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Business Mix</span>
        <select
          value={typeof period === "number" ? String(period) : period}
          onChange={(e) => {
            const v = e.target.value;
            onPeriodChange(v === "ytd" || v === "all" ? v : Number(v));
          }}
          className="border border-line px-1 py-0.5 font-mono text-[10px]"
        >
          <option value="ytd">YTD</option>
          {years
            .filter((y) => y !== currentYear)
            .map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          <option value="all">All-time</option>
        </select>
      </div>

      {grand === 0 ? (
        <div className="flex h-20 items-center justify-center text-[11px] text-ink/40">No data for this period.</div>
      ) : (
        <>
          <div className="h-20">
            <Doughnut
              data={{
                labels: PROJECT_TYPES,
                datasets: [
                  {
                    data: values,
                    backgroundColor: PROJECT_TYPES.map((t) => BRAND_COLORS[t]),
                    borderColor: "#fffdf9",
                    borderWidth: 1.5,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "65%",
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUsd(c.parsed as number)}` } },
                },
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-2.5 gap-y-0.5">
            {PROJECT_TYPES.map(
              (t, i) =>
                values[i] > 0 && (
                  <span key={t} className="flex items-center gap-1 font-mono text-[9px] text-ink/60">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND_COLORS[t] }} />
                    {t}
                  </span>
                )
            )}
          </div>
        </>
      )}
    </div>
  );
}
