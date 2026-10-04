import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMyRole } from "@/lib/profile";
import { canBuildQuotes } from "@/lib/permissions";
import { getProjectDetail } from "@/lib/projects/queries";
import { getQuoteForProject } from "@/lib/quotes/queries";
import { getContractForProject } from "@/lib/contracts/queries";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { ScopeSection } from "@/components/projects/ScopeSection";
import { ProjectStatusActions } from "@/components/projects/ProjectStatusActions";
import { HoursCostSection } from "@/components/projects/HoursCostSection";
import { BillingSection } from "@/components/projects/BillingSection";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ProjectNameEditor } from "@/components/projects/ProjectNameEditor";
import { DeleteProjectSection } from "@/components/projects/DeleteProjectSection";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = await getMyRole();
  if (role === "subcontractor") redirect("/hours");

  const project = await getProjectDetail(id);
  if (!project) notFound();

  const quote = canBuildQuotes(role) ? await getQuoteForProject(id) : null;
  const contract = canBuildQuotes(role) ? await getContractForProject(id) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const breadcrumb = (
    <p className="mt-1.5 text-xs text-ink/60">
      <Link href="/" className="underline underline-offset-2 hover:text-brand-primary">
        Dashboard
      </Link>{" "}
      /{" "}
      <Link href="/?tab=projects" className="underline underline-offset-2 hover:text-brand-primary">
        Projects
      </Link>{" "}
      / {project.name}
    </p>
  );

  return (
    <AppShell role={role} userEmail={user?.email} breadcrumb={breadcrumb}>
      <section className="mb-8">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          {canBuildQuotes(role) ? (
            <ProjectNameEditor projectId={project.id} initialName={project.name} />
          ) : (
            <h2 className="text-xl text-ink">{project.name}</h2>
          )}
          <span className="font-mono text-xs uppercase text-ink/50">{project.type}</span>
          {project.active ? (
            <span className="font-mono text-[10px] uppercase text-positive">Active</span>
          ) : (
            <span className="font-mono text-[10px] uppercase text-ink/40">
              {project.contractValue !== null && project.totalCollected >= project.contractValue ? "Closed" : "Inactive"}
            </span>
          )}
        </div>
        <p className="text-sm text-ink/70">
          Client: {project.clientName}
          {project.state && <> · State: {project.state}</>}
          {project.referralSourceName && <> · Referral: {project.referralSourceName}</>}
        </p>
        {project.notes && <p className="mt-2 text-sm text-ink/60">{project.notes}</p>}
      </section>

      {canBuildQuotes(role) && <ProjectStatusActions project={project} quote={quote} contract={contract} />}

      <CollapsibleSection title="Billing">
        <BillingSection
          projectId={project.id}
          billingMethod={project.billingMethod}
          hourlyRate={project.hourlyRate}
          fixedFeeAmount={project.fixedFeeAmount}
          contractSignedDate={project.contractSignedDate}
          addonHours={project.addonHours}
          addonHourlyRate={project.addonHourlyRate}
          furnitureCommissionRate={project.furnitureCommissionRate}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Scope">
        <ScopeSection
          key={project.type}
          projectId={project.id}
          initialScopeTags={project.scopeTags}
          contractValue={project.contractValue}
          projectType={project.type}
        />
      </CollapsibleSection>

      <MilestoneSection
        projectId={project.id}
        initialMilestones={project.milestones}
        initialActive={project.active}
        contractValue={project.contractValue}
        totalCost={project.totalCost}
        hasUnknownRate={project.hasUnknownRate}
        hasHoursLogged={project.hoursByPerson.length > 0}
      />

      {project.hoursByPerson.length === 0 ? (
        <CollapsibleSection title="Hours & Cost">
          <div className="border border-line bg-surface p-4 text-sm text-ink/50">No hours logged on this project yet.</div>
        </CollapsibleSection>
      ) : (
        <HoursCostSection hoursByPerson={project.hoursByPerson} />
      )}

      {canBuildQuotes(role) && <DeleteProjectSection projectId={project.id} projectName={project.name} />}
    </AppShell>
  );
}
