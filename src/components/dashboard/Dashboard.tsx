"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { DashboardData, RevenueMode } from "@/lib/dashboard/types";
import { ModeToggle } from "./ModeToggle";
import { KpiRow } from "./KpiRow";
import { YoyChart } from "./YoyChart";
import { BreakdownTable } from "./BreakdownTable";
import { ReferralList } from "./ReferralList";
import { BusinessMix } from "./BusinessMix";
import { SowTable } from "./SowTable";

export function Dashboard({ data, userEmail }: { data: DashboardData; userEmail: string | undefined }) {
  const [mode, setMode] = useState<RevenueMode>("collected");
  const rows = useMemo(() => (mode === "collected" ? data.collected : data.committed), [mode, data]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-10 flex items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Below the Trusses" width={44} height={44} />
          <div>
            <h1 className="text-lg text-ink">
              Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
            </h1>
            <p className="text-xs text-ink/60">{userEmail}</p>
          </div>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

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
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
            Residential · Commercial · Furniture
          </span>
        </div>
        <BreakdownTable rows={rows} />
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
            <h2 className="text-lg font-normal">Referral Sources</h2>
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Lifetime $</span>
          </div>
          <ReferralList rows={rows} referralSources={data.referralSources} />
        </div>
        <div>
          <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
            <h2 className="text-lg font-normal">Business Mix</h2>
          </div>
          <BusinessMix rows={rows} currentYear={currentYear} currentMonth={currentMonth} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-lg font-normal">SOW Sent — Did Not Materialize</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
            Historical, for YoY Context
          </span>
        </div>
        <SowTable rows={data.sow} />
      </section>
    </main>
  );
}
