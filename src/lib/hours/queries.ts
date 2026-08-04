import { createClient } from "@/lib/supabase/server";
import type {
  Assignment,
  ProjectOption,
  ProjectTypeName,
  SubcontractorOption,
  SubcontractorProfile,
  SubcontractorRates,
  TimeEntry,
} from "./types";

export async function getMySubcontractorProfile(): Promise<SubcontractorProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("my_subcontractor").select("id, name, specialty").maybeSingle();
  if (error) throw new Error(`my_subcontractor: ${error.message}`);
  return data;
}

export async function getMyAssignedProjects(): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("my_assigned_projects").select("id, name, type").order("name");
  if (error) throw new Error(`my_assigned_projects: ${error.message}`);
  return data ?? [];
}

export async function getMyTimeEntries(subcontractorId: string): Promise<TimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subcontractor_time_entries")
    .select("id, subcontractor_id, project_id, work_date, hours, work_description, hourly_rate, projects(name)")
    .eq("subcontractor_id", subcontractorId)
    .order("work_date", { ascending: false });
  if (error) throw new Error(`subcontractor_time_entries: ${error.message}`);

  return (data ?? []).map((r) => {
    const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
    return {
      id: r.id,
      subcontractorId: r.subcontractor_id,
      subcontractorName: "",
      projectId: r.project_id,
      projectName: project?.name ?? "Unknown project",
      workDate: r.work_date,
      hours: r.hours,
      workDescription: r.work_description,
      hourlyRate: r.hourly_rate,
    };
  });
}

export async function getAllTimeEntriesForAdmin(): Promise<TimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subcontractor_time_entries")
    .select(
      "id, subcontractor_id, project_id, work_date, hours, work_description, hourly_rate, subcontractors(name), projects(name)"
    )
    .order("work_date", { ascending: false });
  if (error) throw new Error(`subcontractor_time_entries (admin): ${error.message}`);

  return (data ?? []).map((r) => {
    const sub = Array.isArray(r.subcontractors) ? r.subcontractors[0] : r.subcontractors;
    const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
    return {
      id: r.id,
      subcontractorId: r.subcontractor_id,
      subcontractorName: sub?.name ?? "Unknown",
      projectId: r.project_id,
      projectName: project?.name ?? "Unknown project",
      workDate: r.work_date,
      hours: r.hours,
      workDescription: r.work_description,
      hourlyRate: r.hourly_rate,
    };
  });
}

export async function getAllSubcontractorOptions(): Promise<SubcontractorOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("subcontractors").select("id, name").order("name");
  if (error) throw new Error(`subcontractors: ${error.message}`);
  return data ?? [];
}

export async function getAllActiveProjectOptions(): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, type")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(`projects: ${error.message}`);
  return data ?? [];
}

export async function getSubcontractorRates(): Promise<SubcontractorRates[]> {
  const supabase = await createClient();
  const [subsRes, typeRatesRes] = await Promise.all([
    supabase.from("subcontractors").select("id, name, default_hourly_rate").order("name"),
    supabase.from("subcontractor_type_rates").select("subcontractor_id, project_type, hourly_rate"),
  ]);
  if (subsRes.error) throw new Error(`subcontractors: ${subsRes.error.message}`);
  if (typeRatesRes.error) throw new Error(`subcontractor_type_rates: ${typeRatesRes.error.message}`);

  const typeRatesBySub = new Map<string, Partial<Record<ProjectTypeName, number>>>();
  for (const r of typeRatesRes.data ?? []) {
    if (!typeRatesBySub.has(r.subcontractor_id)) typeRatesBySub.set(r.subcontractor_id, {});
    typeRatesBySub.get(r.subcontractor_id)![r.project_type as ProjectTypeName] = r.hourly_rate;
  }

  return (subsRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    defaultHourlyRate: s.default_hourly_rate,
    typeRates: typeRatesBySub.get(s.id) ?? {},
  }));
}

export async function getProjectSubcontractorAssignments(): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_subcontractors")
    .select("project_id, subcontractor_id, hourly_rate, allocated_hours");
  if (error) throw new Error(`project_subcontractors: ${error.message}`);
  return (data ?? []).map((r) => ({
    projectId: r.project_id,
    subcontractorId: r.subcontractor_id,
    hourlyRate: r.hourly_rate,
    allocatedHours: r.allocated_hours,
  }));
}
