"use client";

import { useState } from "react";
import type { RevenueMode, RevenueRow } from "@/lib/dashboard/types";
import { ModeToggle } from "./ModeToggle";
import { KpiRow } from "./KpiRow";
import { YoyChart } from "./YoyChart";
import { BreakdownTable } from "./BreakdownTable";
import { BusinessMix, type MixPeriod } from "./BusinessMix";
import { InsightsBlurb } from "./InsightsBlurb";

export function FinancialDashboardTab({
  rows,
  collectedRows,
  forecastRows,
  mode,
  onModeChange,
  currentYear,
  currentMonth,
}: {
  rows: RevenueRow[];
  collectedRows: RevenueRow[];
  forecastRows: RevenueRow[];
  mode: RevenueMode;
  onModeChange: (mode: RevenueMode) => void;
  currentYear: number;
  currentMonth: number;
}) {
  const [mixPeriod, setMixPeriod] = useState<MixPeriod>("ytd");

  function handleYearClick(year: number) {
    setMixPeriod(year === currentYear ? "ytd" : year);
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Dashboard</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">How Are We Doing?</span>
      </div>

      <div className="mb-8 flex items-center justify-end">
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>

      <section className="mb-12">
        <KpiRow
          rows={rows}
          currentYear={currentYear}
          extra={
            <BusinessMix
              rows={rows}
              currentYear={currentYear}
              currentMonth={currentMonth}
              period={mixPeriod}
              onPeriodChange={setMixPeriod}
            />
          }
        />
      </section>

      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-lg font-normal">Year-over-Year Revenue</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
            {mode === "revenue" ? "Cash Collected" : "Revenue + Forecast"}
          </span>
        </div>
        <YoyChart
          collectedRows={collectedRows}
          forecastRows={forecastRows}
          showForecast={mode === "revenue_forecast"}
          currentYear={currentYear}
        />
      </section>

      <InsightsBlurb />

      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-lg font-normal">Monthly Breakdown</h2>
        </div>
        <BreakdownTable rows={rows} onYearClick={handleYearClick} />
      </section>
    </div>
  );
}
