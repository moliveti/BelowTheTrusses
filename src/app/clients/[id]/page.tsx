import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMyRole } from "@/lib/profile";
import { getClientDetail } from "@/lib/clients/queries";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { fmtUsd } from "@/lib/dashboard/format";

const TYPE_CLASS: Record<string, string> = {
  Residential: "text-[var(--positive)]",
  Commercial: "text-brand-primary",
  Furniture: "text-brand-accent",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = await getMyRole();
  if (role === "subcontractor") redirect("/hours");

  const client = await getClientDetail(id);
  if (!client) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const totalPlannedRevenue = client.projects.reduce((s, p) => s + (p.plannedRevenue ?? 0), 0);
  const totalPaid = client.projects.reduce((s, p) => s + p.amountPaid, 0);
  const totalOutstanding = client.projects.reduce((s, p) => s + p.outstandingBalance, 0);

  const breadcrumb = (
    <p className="mt-1.5 text-xs text-ink/60">
      <Link href="/" className="underline underline-offset-2 hover:text-brand-primary">
        Dashboard
      </Link>{" "}
      /{" "}
      <Link href="/?tab=clients" className="underline underline-offset-2 hover:text-brand-primary">
        Clients
      </Link>{" "}
      / {client.name}
    </p>
  );

  return (
    <AppShell role={role} userEmail={user?.email} breadcrumb={breadcrumb}>
      <section className="mb-8">
        <h2 className="mb-2 text-xl text-ink">{client.name}</h2>
        <p className="text-sm text-ink/70">
          {client.projects.length} {client.projects.length === 1 ? "project" : "projects"} · Planned Rev.{" "}
          {totalPlannedRevenue ? fmtUsd(totalPlannedRevenue) : "—"} · Paid {totalPaid ? fmtUsd(totalPaid) : "—"} ·
          Outstanding {totalOutstanding ? fmtUsd(totalOutstanding) : "—"}
        </p>
      </section>

      <section>
        <h3 className="mb-3 border-b-[1.5px] border-ink pb-2 font-mono text-xs uppercase tracking-wide text-ink/60">
          Projects
        </h3>
        {client.projects.length === 0 ? (
          <div className="border border-line bg-surface p-4 text-sm text-ink/50">No projects on this client yet.</div>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                    Project
                  </th>
                  <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                    Type / Active
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                    Planned Rev. / Paid
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                    Outstanding
                  </th>
                </tr>
              </thead>
              <tbody>
                {client.projects.map((p) => (
                  <tr key={p.id} className="border-b border-line hover:bg-canvas">
                    <td className="px-3 py-2.5 text-left">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-brand-primary underline decoration-brand-primary/30 underline-offset-2 hover:decoration-brand-primary"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-left">
                      <div className={`font-mono text-[11px] ${TYPE_CLASS[p.type] ?? ""}`}>{p.type}</div>
                      <div className="font-mono text-[10px] uppercase text-ink/40">{p.active ? "Active" : "Inactive"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="font-mono tabular-nums">{p.plannedRevenue !== null ? fmtUsd(p.plannedRevenue) : "—"}</div>
                      <div className="font-mono text-xs tabular-nums text-ink/60">{p.amountPaid ? fmtUsd(p.amountPaid) : "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="font-mono tabular-nums">{p.outstandingBalance ? fmtUsd(p.outstandingBalance) : "—"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
