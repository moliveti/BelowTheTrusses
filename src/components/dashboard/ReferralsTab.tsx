"use client";

import type { ReferralSource, RevenueMode, RevenueRow } from "@/lib/dashboard/types";
import { ModeToggle } from "./ModeToggle";
import { ReferralList } from "./ReferralList";

export function ReferralsTab({
  rows,
  referralSources,
  mode,
  onModeChange,
}: {
  rows: RevenueRow[];
  referralSources: ReferralSource[];
  mode: RevenueMode;
  onModeChange: (mode: RevenueMode) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Referral Sources</h2>
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>
      <p className="mb-4 text-xs text-ink/60">
        Lifetime totals by referrer — click a row to see its year-over-year breakdown.
      </p>
      <ReferralList rows={rows} referralSources={referralSources} />
    </div>
  );
}
