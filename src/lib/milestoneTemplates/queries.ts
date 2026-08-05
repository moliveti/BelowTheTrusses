import { createClient } from "@/lib/supabase/server";
import type { MilestoneTemplateGroup } from "./types";

export async function getMilestoneTemplates(): Promise<MilestoneTemplateGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestone_templates")
    .select("id, project_type, template_name, name, sequence_order, percent_of_total, offset_days")
    .order("project_type")
    .order("template_name")
    .order("sequence_order");
  if (error) throw new Error(`milestone_templates: ${error.message}`);

  const groups = new Map<string, MilestoneTemplateGroup>();
  for (const row of data ?? []) {
    const key = `${row.project_type}::${row.template_name}`;
    if (!groups.has(key)) {
      groups.set(key, { projectType: row.project_type, templateName: row.template_name, steps: [] });
    }
    groups.get(key)!.steps.push({
      id: row.id,
      name: row.name,
      sequenceOrder: row.sequence_order,
      percentOfTotal: row.percent_of_total,
      offsetDays: row.offset_days,
    });
  }
  return Array.from(groups.values());
}
