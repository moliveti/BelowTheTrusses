import { createClient } from "@/lib/supabase/server";
import type { PaymentRow } from "./types";

/** Every payment milestone across every project, for the standalone Payment Schedules page. No active-only filter — the whole schedule should be visible, filtered client-side if wanted. */
export async function getAllPaymentSchedule(): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select(
      "id, project_id, name, due_date, amount_due, paid_date, amount_paid, status, projects(name, active, clients(name))"
    )
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`milestones (payment schedule): ${error.message}`);

  return (data ?? []).map((m) => {
    const project = Array.isArray(m.projects) ? m.projects[0] : m.projects;
    const client = project ? (Array.isArray(project.clients) ? project.clients[0] : project.clients) : null;
    return {
      id: m.id,
      projectId: m.project_id,
      projectName: project?.name ?? "Unknown project",
      clientName: client?.name ?? "Unknown",
      projectActive: project?.active ?? false,
      name: m.name,
      dueDate: m.due_date,
      amountDue: m.amount_due,
      paidDate: m.paid_date,
      amountPaid: m.amount_paid,
      status: m.status,
    };
  });
}
