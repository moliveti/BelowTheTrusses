"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
import { SignOutButton } from "@/components/SignOutButton";
import {
  ChartIcon,
  ChevronIcon,
  ContractedIcon,
  LeadsIcon,
  PriorityIcon,
  ProductivityIcon,
  ProjectsIcon,
  ReferralIcon,
  SowIcon,
  TeamIcon,
  type IconProps,
} from "./NavIcons";

type Tab = "today" | "financial" | "leads" | "referrals" | "contracted" | "productivity" | "projects" | "sow" | "team";

// "Priorities" (nav key "today", unchanged for URL/state stability) sits
// second per the product distinction: Financial Dashboard answers "how are
// we doing?", Priorities answers "what should we do?" — the owner wanted
// the established Financial Dashboard landing experience to stay first.
const TABS: { key: Tab; label: string; description: string; Icon: (props: IconProps) => React.JSX.Element }[] = [
  { key: "financial", label: "Financial Dashboard", description: "Revenue, forecast, and business mix", Icon: ChartIcon },
  { key: "today", label: "Priorities", description: "What needs attention today", Icon: PriorityIcon },
  { key: "leads", label: "Leads", description: "Intake and follow-up pipeline", Icon: LeadsIcon },
  { key: "referrals", label: "Referral Sources", description: "Revenue by referral relationship", Icon: ReferralIcon },
  { key: "contracted", label: "Contracted Work", description: "Subcontractor hours and cost", Icon: ContractedIcon },
  { key: "productivity", label: "Productivity", description: "Hours logged by person", Icon: ProductivityIcon },
  { key: "projects", label: "Projects", description: "All projects and billing status", Icon: ProjectsIcon },
  { key: "sow", label: "Business Not Materialized", description: "Proposals that didn't convert", Icon: SowIcon },
  { key: "team", label: "Team", description: "Manage users and access", Icon: TeamIcon },
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = (TAB_KEYS as string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "financial";
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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

  const visibleTabs = TABS.filter((t) => t.key !== "team" || role === "owner");
  const sidebarWidth = sidebarExpanded ? "w-56" : "w-16";

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen ${sidebarWidth} flex-col border-r border-line bg-canvas transition-[width] duration-150`}
      >
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3">
          {visibleTabs.map((t) => (
            <div key={t.key} className="group relative px-2">
              <button
                onClick={() => setTab(t.key)}
                className={`flex w-full items-center gap-3 rounded px-2.5 py-2.5 text-left transition ${
                  tab === t.key ? "bg-brand-primary text-white" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <t.Icon className="h-[18px] w-[18px] shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate font-mono text-[11px] uppercase tracking-wide">{t.label}</span>
                )}
              </button>

              {!sidebarExpanded && (
                <div className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-ink px-2.5 py-1.5 text-xs text-white opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-[10.5px] text-white/70">{t.description}</div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <button
          onClick={() => setSidebarExpanded((v) => !v)}
          className="flex items-center justify-center gap-2 border-t border-line py-3 text-ink/50 hover:text-ink"
          title={sidebarExpanded ? "Collapse" : "Expand"}
        >
          <ChevronIcon direction={sidebarExpanded ? "left" : "right"} className="h-4 w-4" />
          {sidebarExpanded && <span className="font-mono text-[10px] uppercase tracking-wide">Collapse</span>}
        </button>
      </aside>

      <div className={`min-h-screen transition-[margin] duration-150 ${sidebarExpanded ? "ml-56" : "ml-16"}`}>
        <header className="sticky top-0 z-20 border-b border-line bg-canvas px-6 py-6 md:px-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <Image src="/logo.png" alt="Below the Trusses" width={236} height={128} className="h-32 w-auto" />
            <div className="text-right">
              {userEmail && <p className="mb-1.5 text-xs text-ink/60">{userEmail}</p>}
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="px-6 py-10 md:px-10">
        <div className="mx-auto max-w-6xl">
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
        </div>
        </main>
      </div>
    </>
  );
}
