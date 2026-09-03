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
import { fmtUsd } from "@/lib/dashboard/format";

const fmtDate = (d: string | null) => d ?? "—";

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
          <h2 className="text-xl text-ink">{project.name}</h2>
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

      <section className="mb-8">
        <h3 className="mb-3 border-b-[1.5px] border-ink pb-2 font-mono text-xs uppercase tracking-wide text-ink/60">
          Billing
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-line bg-surface p-4 text-sm sm:grid-cols-3">
          <Field label="Billing Method" value={project.billingMethod ?? "—"} />
          <Field label="Contract Signed" value={fmtDate(project.contractSignedDate)} />
          <Field label="Hourly Rate" value={project.hourlyRate !== null ? fmtUsd(project.hourlyRate) + "/hr" : "—"} />
          <Field label="Fixed Fee" value={project.fixedFeeAmount !== null ? fmtUsd(project.fixedFeeAmount) : "—"} />
          <Field
            label="Add-on Hours"
            value={project.addonHours !== null ? `${project.addonHours} hrs @ ${fmtUsd(project.addonHourlyRate ?? 0)}/hr` : "—"}
          />
          <Field
            label="Furniture Commission"
            value={
              project.furnitureCommissionRate !== null
                ? `${(project.furnitureCommissionRate * 100).toFixed(0)}% (reference only)`
                : "—"
            }
          />
        </div>
      </section>

      <section className="mb-8">
        <h3 className="mb-3 border-b-[1.5px] border-ink pb-2 font-mono text-xs uppercase tracking-wide text-ink/60">
          Scope
        </h3>
        <ScopeSection
          projectId={project.id}
          initialScopeTags={project.scopeTags}
          contractValue={project.contractValue}
          projectType={project.type}
        />
      </section>

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
        <section>
          <h3 className="mb-3 border-b-[1.5px] border-ink pb-2 font-mono text-xs uppercase tracking-wide text-ink/60">
            Hours &amp; Cost
          </h3>
          <div className="border border-line bg-surface p-4 text-sm text-ink/50">No hours logged on this project yet.</div>
        </section>
      ) : (
        <HoursCostSection hoursByPerson={project.hoursByPerson} />
      )}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink/50">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
