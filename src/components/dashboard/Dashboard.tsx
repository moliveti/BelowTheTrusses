"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { DashboardData, RevenueMode } from "@/lib/dashboard/types";
import type { Assignment, ProjectOption, SubcontractorOption, SubcontractorRates, TimeEntry } from "@/lib/hours/types";
import type { ProjectListItem } from "@/lib/projects/types";
import type { Lead } from "@/lib/leads/types";
import { FinancialDashboardTab } from "./FinancialDashboardTab";
import { ReferralsTab } from "./ReferralsTab";
import { SowTab } from "./SowTab";
import { ContractedWorkTab } from "./ContractedWorkTab";
import { ProductivityTab } from "./ProductivityTab";
import { LeadsTab } from "./LeadsTab";
import { ProjectsIndex } from "@/components/projects/ProjectsIndex";
import { SignOutButton } from "@/components/SignOutButton";

type Tab = "financial" | "leads" | "referrals" | "contracted" | "productivity" | "projects" | "sow";

const TABS: { key: Tab; label: string }[] = [
  { key: "financial", label: "Financial Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "referrals", label: "Referral Sources" },
  { key: "contracted", label: "Contracted Work" },
  { key: "productivity", label: "Productivity" },
  { key: "projects", label: "Projects" },
  { key: "sow", label: "Business Not Materialized" },
];

const TAB_KEYS = TABS.map((t) => t.key);

interface ContractedWorkData {
  timeEntries: TimeEntry[];
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  assignments: Assignment[];
  rates: SubcontractorRates[];
}

export function Dashboard({
  data,
  userEmail,
  contractedWork,
  projects,
  leads,
}: {
  data: DashboardData;
  userEmail: string | undefined;
  contractedWork: ContractedWorkData;
  projects: ProjectListItem[];
  leads: Lead[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = (TAB_KEYS as string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "financial";

  const [mode, setMode] = useState<RevenueMode>("revenue");
  const rows = useMemo(
    () => (mode === "revenue" ? data.collected : [...data.collected, ...data.forecast]),
    [mode, data]
  );

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "financial") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <header className="flex items-center justify-between gap-4 border-b border-line py-5">
            <div className="flex items-center gap-4">
              <Image src="/logo.png" alt="Below the Trusses" width={236} height={128} className="h-32 w-auto" />
              <div>
                <h1 className="text-2xl text-ink">
                  Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
                </h1>
                <p className="text-xs text-ink/60">{userEmail}</p>
              </div>
            </div>
            <SignOutButton />
          </header>

          <nav className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-3 font-mono text-xs uppercase tracking-wide transition ${
                  tab === t.key
                    ? "border-b-2 border-brand-accent text-ink"
                    : "text-ink/50 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        {tab === "financial" && (
          <FinancialDashboardTab
            rows={rows}
            collectedRows={data.collected}
            forecastRows={data.forecast}
            mode={mode}
            onModeChange={setMode}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        )}
        {tab === "leads" && <LeadsTab leads={leads} referralSources={data.referralSources} />}
        {tab === "referrals" && (
          <ReferralsTab
            collectedRows={data.collected}
            forecastRows={data.forecast}
            referralSources={data.referralSources}
            mode={mode}
            onModeChange={setMode}
          />
        )}
        {tab === "contracted" && (
          <ContractedWorkTab
            entries={contractedWork.timeEntries}
            subcontractors={contractedWork.subcontractors}
            activeProjects={contractedWork.activeProjects}
            initialAssignments={contractedWork.assignments}
            rates={contractedWork.rates}
          />
        )}
        {tab === "productivity" && (
          <ProductivityTab entries={contractedWork.timeEntries} />
        )}
        {tab === "projects" && <ProjectsIndex projects={projects} />}
        {tab === "sow" && <SowTab rows={data.sow} />}
      </main>
    </>
  );
}
