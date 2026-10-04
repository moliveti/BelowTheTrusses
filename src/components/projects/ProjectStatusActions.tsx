"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProjectDetail } from "@/lib/projects/types";
import type { Quote } from "@/lib/quotes/types";
import type { ContractSummary } from "@/lib/contracts/types";
import { ContractBuilderPanel } from "@/components/dashboard/ContractBuilderPanel";
import { markProjectSigned } from "@/lib/records/convert";

const PROJECT_TYPES = ["Residential", "Commercial", "Furniture"] as const;

export function ProjectStatusActions({
  project,
  quote,
  contract,
}: {
  project: ProjectDetail;
  quote: Quote | null;
  contract: ContractSummary | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(project.status);
  const [projectType, setProjectType] = useState(project.type);
  const [savingType, setSavingType] = useState(false);
  const [showContractBuilder, setShowContractBuilder] = useState(false);
  const [lastContractId, setLastContractId] = useState<string | null>(contract?.id ?? null);
  const [markingUnderContract, setMarkingUnderContract] = useState(false);
  const [signError, setSignError] = useState("");

  async function markUnderContract() {
    setMarkingUnderContract(true);
    setSignError("");
    const result = await markProjectSigned(createClient(), project.id);
    setMarkingUnderContract(false);
    if ("error" in result) {
      setSignError(result.error);
      return;
    }
    setStatus("Under Contract");
    router.refresh();
  }

  // Plain corrective edit for a mis-entered type -- no cascading
  // recalculation of rates/fees tied to type elsewhere.
  async function changeProjectType(newType: string) {
    setSavingType(true);
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ type: newType }).eq("id", project.id);
    setSavingType(false);
    if (!error) {
      setProjectType(newType);
      router.refresh();
    }
  }

  if (!status) return null;

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 border border-line bg-surface p-3">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink/50">Contract Status</span>
      <span className="border border-brand-accent bg-brand-accent/10 px-2 py-0.5 font-mono text-[10.5px] uppercase text-brand-accent">
        {status}
      </span>

      <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">Project Type</span>
      <select
        value={projectType}
        disabled={savingType}
        onChange={(e) => changeProjectType(e.target.value)}
        className="border border-line px-2 py-1 font-mono text-[10.5px] uppercase disabled:opacity-50"
      >
        {PROJECT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {quote && (
        <a
          href={`/api/quotes/${quote.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] uppercase text-brand-primary underline underline-offset-2"
        >
          Download Quote PDF
        </a>
      )}

      {status === "Quoted" && (
        <button
          onClick={() => setShowContractBuilder(true)}
          className="ml-auto bg-brand-primary px-3 py-1.5 font-mono text-[11px] uppercase text-white hover:bg-brand-primary/90"
        >
          Generate Contract
        </button>
      )}

      {lastContractId && (
        <a
          href={`/api/contracts/${lastContractId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] uppercase text-brand-primary underline underline-offset-2"
        >
          Download Contract PDF
        </a>
      )}

      {status === "Contract Sent" && (
        <>
          {signError && <span className="ml-auto text-xs text-warning">{signError}</span>}
          <button
            onClick={markUnderContract}
            disabled={markingUnderContract}
            className={`${signError ? "" : "ml-auto "}border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas disabled:opacity-50`}
          >
            {markingUnderContract ? "Saving…" : "Mark Contract Signed"}
          </button>
        </>
      )}

      {showContractBuilder && (
        <ContractBuilderPanel
          project={project}
          quote={quote}
          onClose={() => setShowContractBuilder(false)}
          onCreated={(contractId) => {
            setStatus("Contract Sent");
            setLastContractId(contractId);
            setShowContractBuilder(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
