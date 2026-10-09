/**
 * A project that is still moving through the sales pipeline (quoted, or
 * contract sent but not yet signed) lives in Residential Quotes, not the Projects
 * list. It only counts as in the pipeline while a lead is still tracking it:
 * a project with no lead behind it, or whose lead is already Signed Contract,
 * is shown so it can't end up invisible everywhere.
 */
export function isInSalesPipeline(
  project: { id: string; status: string | null },
  trackedByOpenLead: ReadonlySet<string>
): boolean {
  const preContract = project.status === "Quoted" || project.status === "Contract Sent";
  return preContract && trackedByOpenLead.has(project.id);
}
