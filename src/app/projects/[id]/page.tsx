import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getMyRole } from "@/lib/profile";
import { getProjectDetail } from "@/lib/projects/queries";
import { SignOutButton } from "@/components/SignOutButton";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { fmtUsd } from "@/lib/dashboard/format";

const fmtDate = (d: string | null) => d ?? "—";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = await getMyRole();
  if (role === "subcontractor") redirect("/hours");

  const project = await getProjectDetail(id);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Below the Trusses" width={44} height={44} />
          <div>
            <h1 className="text-lg text-ink">
              Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
            </h1>
            <p className="text-xs text-ink/60">
              <Link href="/" className="underline underline-offset-2 hover:text-brand-primary">
                Dashboard
              </Link>{" "}
              /{" "}
              <Link href="/?tab=projects" className="underline underline-offset-2 hover:text-brand-primary">
                Projects
              </Link>{" "}
              / {project.name}
            </p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <section className="mb-8">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl text-ink">{project.name}</h2>
          <span className="font-mono text-xs uppercase text-ink/50">{project.type}</span>
          {project.active ? (
            <span className="font-mono text-[10px] uppercase text-positive">Active</span>
          ) : (
            <span className="font-mono text-[10px] uppercase text-ink/40">Inactive</span>
          )}
        </div>
        <p className="text-sm text-ink/70">
          Client: {project.clientName}
          {project.state && <> · State: {project.state}</>}
          {project.referralSourceName && <> · Referral: {project.referralSourceName}</>}
        </p>
        {project.notes && <p className="mt-2 text-sm text-ink/60">{project.notes}</p>}
      </section>

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
        {project.scopeTags.length === 0 ? (
          <div className="border border-line bg-surface p-4 text-sm text-ink/50">
            {project.type === "Residential" ? "Not tagged yet." : "Scope tracking applies to Residential projects only."}
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Category</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Amount</th>
                </tr>
              </thead>
              <tbody>
                {project.scopeTags.map((s) => (
                  <tr key={s.name} className="border-b border-line">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{s.amount !== null ? fmtUsd(s.amount) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MilestoneSection
        projectId={project.id}
        initialMilestones={project.milestones}
        contractValue={project.contractValue}
        totalCost={project.totalCost}
        hasUnknownRate={project.hasUnknownRate}
        hasHoursLogged={project.hoursByPerson.length > 0}
      />

      <section>
        <h3 className="mb-3 border-b-[1.5px] border-ink pb-2 font-mono text-xs uppercase tracking-wide text-ink/60">
          Hours &amp; Cost
        </h3>
        {project.hoursByPerson.length === 0 ? (
          <div className="border border-line bg-surface p-4 text-sm text-ink/50">No hours logged on this project yet.</div>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Allocated</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Rate</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
                </tr>
              </thead>
              <tbody>
                {project.hoursByPerson.map((h) => (
                  <tr key={h.subcontractorId} className="border-b border-line">
                    <td className="px-3 py-2">{h.subcontractorName}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{h.hours.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{h.allocatedHours !== null ? h.allocatedHours.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{h.rate !== null ? fmtUsd(h.rate) + "/hr" : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{h.cost !== null ? fmtUsd(h.cost) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-[1.5px] border-ink font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {project.hoursByPerson.reduce((s, h) => s + h.hours, 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtUsd(project.totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
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
