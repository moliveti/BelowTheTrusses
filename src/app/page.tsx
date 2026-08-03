import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/queries";
import {
  getAllActiveProjectOptions,
  getAllSubcontractorOptions,
  getAllTimeEntriesForAdmin,
  getProjectSubcontractorAssignments,
} from "@/lib/hours/queries";
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

  const [data, timeEntries, subcontractors, activeProjects, assignments] = await Promise.all([
    getDashboardData(),
    getAllTimeEntriesForAdmin(),
    getAllSubcontractorOptions(),
    getAllActiveProjectOptions(),
    getProjectSubcontractorAssignments(),
  ]);

  return (
    <Dashboard
      data={data}
      userEmail={user?.email}
      contractedWork={{ timeEntries, subcontractors, activeProjects, assignments }}
    />
  );
}
