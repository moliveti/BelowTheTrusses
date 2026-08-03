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

export function YoyChart({
  collectedRows,
  forecastRows,
  showForecast,
  currentYear,
}: {
  collectedRows: RevenueRow[];
  forecastRows: RevenueRow[];
  showForecast: boolean;
  currentYear: number;
}) {
  const allRows = [...collectedRows, ...forecastRows];
  const years = distinctYears(allRows);

  if (years.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center border border-line bg-surface text-sm text-ink/50">
        No data for this view yet.
      </div>
    );
  }

  // dataIndex -> forecast $ for the current year, so the tooltip can show
  // the forecast slice on its own rather than the cumulative stacked value.
  const forecastByMonth = monthlyTotalsForYear(forecastRows, currentYear);

  const datasets = years.map((year, i) => {
    const isCurrent = year === currentYear;

    if (isCurrent && showForecast) {
      const revenueMonthly = monthlyTotalsForYear(collectedRows, currentYear);
      const cumulativeMonthly = revenueMonthly.map((v, idx) => v + forecastByMonth[idx]);
      return [
        {
          label: `${year} Revenue`,
          data: revenueMonthly,
          borderColor: "#b8894a",
          backgroundColor: "rgba(184,137,74,0.1)",
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 2,
          fill: "origin" as const,
          order: 2,
        },
        {
          label: `${year} Forecast`,
          data: cumulativeMonthly,
          borderColor: "#b8894a",
          borderDash: [4, 3],
          backgroundColor: "rgba(184,137,74,0.22)",
          borderWidth: 1.5,
          tension: 0.25,
          pointRadius: 2,
          fill: "-1" as const,
          order: 1,
        },
      ];
    }

    return [
      {
        label: String(year),
        data: monthlyTotalsForYear(allRows, year),
        borderColor: isCurrent ? "#b8894a" : NEUTRAL_COLORS[i % NEUTRAL_COLORS.length],
        backgroundColor: isCurrent ? "rgba(184,137,74,0.08)" : "transparent",
        borderWidth: isCurrent ? 2.5 : 2,
        tension: 0.25,
        pointRadius: 2,
        fill: isCurrent,
        order: 2,
      },
    ];
  });

  return (
    <div className="h-80 border border-line bg-surface p-5">
      <Line
        data={{ labels: MONTH_LABELS, datasets: datasets.flat() }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { boxWidth: 12, font: { family: "SFMono-Regular" } } },
            tooltip: {
              callbacks: {
                label: (c) => {
                  if (c.dataset.label?.endsWith("Forecast")) {
                    return `Forecast: ${fmtUsd(forecastByMonth[c.dataIndex])}`;
                  }
                  return `${c.dataset.label}: ${fmtUsd(c.parsed.y as number)}`;
                },
              },
            },
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
