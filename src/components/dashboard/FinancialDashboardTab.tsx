"use client";

import { useState } from "react";
import type { RevenueMode, RevenueRow } from "@/lib/dashboard/types";
import { ModeToggle } from "./ModeToggle";
import { KpiRow } from "./KpiRow";
import { YoyChart } from "./YoyChart";
import { BreakdownTable } from "./BreakdownTable";
import { BusinessMix, type MixPeriod } from "./BusinessMix";

export function FinancialDashboardTab({
  rows,
  mode,
  onModeChange,
  currentYear,
  currentMonth,
}: {
  rows: RevenueRow[];
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
      <div className="mb-8 flex items-center justify-end">
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>

      <section className="mb-12">
        <KpiRow rows={rows} currentYear={currentYear} />
      </section>

      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-lg font-normal">Year-over-Year Revenue</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
            {mode === "collected" ? "Cash Collected" : "Signed & Committed"}
          </span>
        </div>
        <YoyChart rows={rows} currentYear={currentYear} />
      </section>

      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-lg font-normal">Monthly Breakdown</h2>
        </div>
        <BreakdownTable rows={rows} onYearClick={handleYearClick} />
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-lg font-normal">Business Mix</h2>
        </div>
        <BusinessMix
          rows={rows}
          currentYear={currentYear}
          currentMonth={currentMonth}
          period={mixPeriod}
          onPeriodChange={setMixPeriod}
        />
      </section>
    </div>
  );
}
