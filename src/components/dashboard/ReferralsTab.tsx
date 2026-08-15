"use client";

import type { ReferralSource, RevenueMode, RevenueRow } from "@/lib/dashboard/types";
import { ModeToggle } from "./ModeToggle";
import { ReferralList } from "./ReferralList";

export function ReferralsTab({
  collectedRows,
  forecastRows,
  referralSources,
  mode,
  onModeChange,
}: {
  collectedRows: RevenueRow[];
  forecastRows: RevenueRow[];
  referralSources: ReferralSource[];
  mode: RevenueMode;
  onModeChange: (mode: RevenueMode) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Referral Sources</h2>
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>
      <p className="mb-4 text-xs text-ink/60">
        Lifetime totals by referrer — click a row to see its year-over-year breakdown.
        {mode === "revenue_forecast" && " The lighter segment is still-outstanding forecast, not yet collected."}
      </p>
      <ReferralList
        collectedRows={collectedRows}
        forecastRows={mode === "revenue_forecast" ? forecastRows : []}
        referralSources={referralSources}
      />
    </div>
  );
}
