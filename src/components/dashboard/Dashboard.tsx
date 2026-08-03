"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { DashboardData, RevenueMode } from "@/lib/dashboard/types";
import type { Assignment, ProjectOption, SubcontractorOption, TimeEntry } from "@/lib/hours/types";
import type { ProjectListItem } from "@/lib/projects/types";
import { FinancialDashboardTab } from "./FinancialDashboardTab";
import { ReferralsTab } from "./ReferralsTab";
import { SowTab } from "./SowTab";
import { ContractedWorkTab } from "./ContractedWorkTab";
import { ProductivityTab } from "./ProductivityTab";
import { ProjectsIndex } from "@/components/projects/ProjectsIndex";
import { SignOutButton } from "@/components/SignOutButton";

type Tab = "financial" | "referrals" | "contracted" | "productivity" | "projects" | "sow";

const TABS: { key: Tab; label: string }[] = [
  { key: "financial", label: "Financial Dashboard" },
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
}

export function Dashboard({
  data,
  userEmail,
  contractedWork,
  projects,
}: {
  data: DashboardData;
  userEmail: string | undefined;
  contractedWork: ContractedWorkData;
  projects: ProjectListItem[];
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
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Below the Trusses" width={44} height={44} />
          <div>
            <h1 className="text-lg text-ink">
              Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
            </h1>
            <p className="text-xs text-ink/60">{userEmail}</p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <nav className="mb-10 flex flex-wrap gap-1 border-b border-line">
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
      {tab === "referrals" && (
        <ReferralsTab rows={rows} referralSources={data.referralSources} mode={mode} onModeChange={setMode} />
      )}
      {tab === "contracted" && (
        <ContractedWorkTab
          entries={contractedWork.timeEntries}
          subcontractors={contractedWork.subcontractors}
          activeProjects={contractedWork.activeProjects}
          initialAssignments={contractedWork.assignments}
        />
      )}
      {tab === "productivity" && (
        <ProductivityTab entries={contractedWork.timeEntries} assignments={contractedWork.assignments} />
      )}
      {tab === "projects" && <ProjectsIndex projects={projects} />}
      {tab === "sow" && <SowTab rows={data.sow} />}
    </main>
  );
}
