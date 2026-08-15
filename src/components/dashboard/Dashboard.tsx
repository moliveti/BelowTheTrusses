"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DashboardData, RevenueMode } from "@/lib/dashboard/types";
import type { Assignment, ProjectOption, SubcontractorOption, SubcontractorRates, TimeEntry } from "@/lib/hours/types";
import type { ProjectListItem } from "@/lib/projects/types";
import type { Lead } from "@/lib/leads/types";
import type { MilestoneTemplateGroup } from "@/lib/milestoneTemplates/types";
import type { TeamMember } from "@/lib/admin/types";
import type { Role } from "@/lib/profile";
import type { RecommendationRow } from "@/lib/intelligence/queries";
import { FinancialDashboardTab } from "./FinancialDashboardTab";
import { ReferralsTab } from "./ReferralsTab";
import { SowTab } from "./SowTab";
import { ContractedWorkTab } from "./ContractedWorkTab";
import { ProductivityTab } from "./ProductivityTab";
import { LeadsTab } from "./LeadsTab";
import { TeamTab } from "./TeamTab";
import { TodayTab } from "./TodayTab";
import { ProjectsIndex } from "@/components/projects/ProjectsIndex";
import { AppShell } from "@/components/AppShell";
import { TAB_KEYS, type Tab } from "@/components/AppSidebar";

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
  milestoneTemplates,
  role,
  team,
  recommendations,
}: {
  data: DashboardData;
  userEmail: string | undefined;
  contractedWork: ContractedWorkData;
  projects: ProjectListItem[];
  leads: Lead[];
  milestoneTemplates: MilestoneTemplateGroup[];
  role: Role | null;
  team: TeamMember[];
  recommendations: RecommendationRow[];
}) {
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

  return (
    <AppShell role={role} userEmail={userEmail}>
      {tab === "today" && <TodayTab recommendations={recommendations} />}
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
      {tab === "leads" && (
        <LeadsTab leads={leads} referralSources={data.referralSources} milestoneTemplates={milestoneTemplates} />
      )}
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
      {tab === "productivity" && <ProductivityTab entries={contractedWork.timeEntries} />}
      {tab === "projects" && <ProjectsIndex projects={projects} />}
      {tab === "sow" && <SowTab rows={data.sow} />}
      {tab === "team" && role === "owner" && <TeamTab team={team} />}
    </AppShell>
  );
}
