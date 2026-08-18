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
import type { Signal } from "@/lib/intelligence/types";
import type { BackupRow, CurrentCycleStatus } from "@/lib/backup/queries";
import type { GovernmentOpportunity, MarketIntelLead, MarketIntelRun } from "@/lib/government/types";
import { yearTotal, yoyDeltaPct, referralTotals } from "@/lib/dashboard/aggregate";
import { FinancialDashboardTab } from "./FinancialDashboardTab";
import { AIAnalyticsTab } from "./AIAnalyticsTab";
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
  weeklyExtras,
  backupHistory,
  currentBackupCycle,
  opportunities,
  marketIntelLeads,
  marketIntelRun,
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
  weeklyExtras: Signal[];
  backupHistory: BackupRow[];
  currentBackupCycle: CurrentCycleStatus;
  opportunities: GovernmentOpportunity[];
  marketIntelLeads: MarketIntelLead[];
  marketIntelRun: MarketIntelRun | null;
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

  const monthStats = useMemo(() => {
    const combined = [...data.collected, ...data.forecast];
    const currentTotal = yearTotal(combined, currentYear);
    const priorTotal = yearTotal(combined, currentYear - 1);
    const topReferral = referralTotals(combined, data.referralSources)[0] ?? null;
    const lifetimeTotal = combined.reduce((s, r) => s + r.amount, 0);
    return {
      yoyDeltaPct: yoyDeltaPct(currentTotal, priorTotal),
      topReferralName: topReferral?.name ?? null,
      topReferralSharePct: topReferral && lifetimeTotal > 0 ? Math.round((topReferral.total / lifetimeTotal) * 100) : null,
    };
  }, [data, currentYear]);

  return (
    <AppShell role={role} userEmail={userEmail}>
      {tab === "today" && (
        <TodayTab
          recommendations={recommendations}
          weeklyExtras={weeklyExtras}
          monthStats={monthStats}
          projects={projects}
          sowRows={data.sow}
          assignments={contractedWork.assignments}
          assignmentProjects={contractedWork.activeProjects}
          assignmentSubcontractors={contractedWork.subcontractors}
        />
      )}
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
      {tab === "ai-analytics" && (
        <AIAnalyticsTab
          collectedRows={data.collected}
          forecastRows={data.forecast}
          currentYear={currentYear}
          opportunities={opportunities}
          leads={marketIntelLeads}
          marketIntelUpdatedAt={
            marketIntelRun
              ? new Date(`${marketIntelRun.weekOf}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : null
          }
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
      {tab === "team" && role === "owner" && (
        <TeamTab team={team} backupHistory={backupHistory} currentBackupCycle={currentBackupCycle} marketIntelRun={marketIntelRun} />
      )}
    </AppShell>
  );
}
