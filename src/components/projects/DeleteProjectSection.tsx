"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteProjectCascade, loadProjectImpact, projectBlockers, type ProjectImpact } from "@/lib/records/delete";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DeleteProjectSection({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<ProjectImpact | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function openDialog() {
    setOpen(true);
    setImpact(null);
    setLoadError("");
    setError("");
    const result = await loadProjectImpact(createClient(), projectId);
    if ("error" in result) setLoadError(result.error);
    else setImpact(result);
  }

  function leave() {
    router.push("/?tab=projects");
    router.refresh();
  }

  async function confirm() {
    setBusy(true);
    setError("");
    const result = await deleteProjectCascade(createClient(), projectId);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(leave, 2500);
  }

  const removes: string[] = [];
  const keeps: string[] = [];
  let blockedReasons: string[] | undefined;
  if (loadError) {
    blockedReasons = [loadError];
  } else if (impact) {
    const blockers = projectBlockers(impact);
    if (blockers.length > 0) blockedReasons = blockers;
    removes.push(`Project "${impact.name}"`);
    if (impact.milestoneCount > 0) removes.push(`${plural(impact.milestoneCount, "payment milestone", "payment milestones")} (nothing paid on any of them)`);
    if (impact.allocationCount > 0) removes.push(`${plural(impact.allocationCount, "contractor hour allocation", "contractor hour allocations")}`);
    if (impact.quoteIds.length > 0) removes.push(`${plural(impact.quoteIds.length, "quote", "quotes")} and their line items`);
    if (impact.contracts.length > 0) removes.push(`${plural(impact.contracts.length, "unsigned contract", "unsigned contracts")}`);
    keeps.push("The client record, and any lead tied to this project (a lead still at the quote stage goes back to New Prospect)");
  }

  return (
    <section className="mb-8 border-t border-line pt-6">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/60">Danger Zone</h3>
      <p className="mb-3 text-sm text-ink/60">
        Delete this project if it was created by mistake or is a duplicate. Projects with logged hours, recorded payments, or a signed contract are protected.
      </p>
      <button
        onClick={openDialog}
        className="border border-warning px-3 py-1.5 font-mono text-[11px] uppercase text-warning hover:bg-warning/10"
      >
        Delete Project
      </button>

      {open && (
        <ConfirmDeleteDialog
          title={`Delete project — ${projectName}?`}
          loading={impact === null && !loadError}
          removes={removes}
          keeps={keeps}
          blockedReasons={blockedReasons}
          blockedIntro={loadError ? "Couldn't check what's linked to this project:" : "This project can't be deleted because it has:"}
          blockedNote={loadError ? "" : undefined}
          confirmLabel="Delete Project"
          busy={busy}
          error={error}
          doneMessage={done ? `Project "${projectName}" was deleted. Taking you back to Projects…` : undefined}
          doneLabel="Back to Projects"
          onConfirm={confirm}
          onCancel={() => setOpen(false)}
          onDone={leave}
        />
      )}
    </section>
  );
}
