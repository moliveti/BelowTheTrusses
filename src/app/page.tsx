import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/queries";
import {
  getAllActiveProjectOptions,
  getAllSubcontractorOptions,
  getAllTimeEntriesForAdmin,
  getProjectSubcontractorAssignments,
  getSubcontractorRates,
} from "@/lib/hours/queries";
import { getProjectsIndex } from "@/lib/projects/queries";
import { getLeads } from "@/lib/leads/queries";
import { getMilestoneTemplates } from "@/lib/milestoneTemplates/queries";
import { getTeamMembers } from "@/lib/admin/queries";
import { getActiveRecommendations } from "@/lib/intelligence/queries";
import { getMyRole } from "@/lib/profile";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default async function HomePage() {
  const role = await getMyRole();
  if (role === "subcontractor") {
    redirect("/hours");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [data, timeEntries, subcontractors, activeProjects, assignments, projects, rates, leads, milestoneTemplates, team] =
    await Promise.all([
      getDashboardData(),
      getAllTimeEntriesForAdmin(),
      getAllSubcontractorOptions(),
      getAllActiveProjectOptions(),
      getProjectSubcontractorAssignments(),
      getProjectsIndex(),
      getSubcontractorRates(),
      getLeads(),
      getMilestoneTemplates(),
      role === "owner" ? getTeamMembers() : Promise.resolve([]),
    ]);

  // Reuses the leads/dashboard/projects data already fetched above rather
  // than re-querying them inside the intelligence layer.
  const recommendations = await getActiveRecommendations({ leads, dashboardData: data, projects });

  return (
    <Dashboard
      data={data}
      userEmail={user?.email}
      contractedWork={{ timeEntries, subcontractors, activeProjects, assignments, rates }}
      projects={projects}
      leads={leads}
      milestoneTemplates={milestoneTemplates}
      role={role}
      team={team}
      recommendations={recommendations}
    />
  );
}
