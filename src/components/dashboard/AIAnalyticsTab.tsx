"use client";

import type { RevenueRow } from "@/lib/dashboard/types";
import type { GovernmentOpportunity } from "@/lib/government/types";
import { YoyChart } from "./YoyChart";
import { InsightsBlurb } from "./InsightsBlurb";
import { MarketIntelSection } from "./MarketIntelSection";

export function AIAnalyticsTab({
  collectedRows,
  forecastRows,
  currentYear,
  gaOpportunities,
}: {
  collectedRows: RevenueRow[];
  forecastRows: RevenueRow[];
  currentYear: number;
  gaOpportunities: GovernmentOpportunity[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">AI Analytics</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">What&rsquo;s Affecting Revenue</span>
      </div>

      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-lg font-normal">Year-over-Year Revenue</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Revenue + Forecast</span>
        </div>
        <YoyChart collectedRows={collectedRows} forecastRows={forecastRows} showForecast currentYear={currentYear} />
      </section>

      <InsightsBlurb />

      <MarketIntelSection gaOpportunities={gaOpportunities} />
    </div>
  );
}
