"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProjectDetail } from "@/lib/projects/types";
import type { Quote } from "@/lib/quotes/types";
import type { ContractSummary } from "@/lib/contracts/types";
import { ContractBuilderPanel } from "@/components/dashboard/ContractBuilderPanel";

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
  const [showContractBuilder, setShowContractBuilder] = useState(false);
  const [lastContractId, setLastContractId] = useState<string | null>(contract?.id ?? null);
  const [markingUnderContract, setMarkingUnderContract] = useState(false);

  async function markUnderContract() {
    setMarkingUnderContract(true);
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ status: "Under Contract" }).eq("id", project.id);
    setMarkingUnderContract(false);
    if (!error) {
      setStatus("Under Contract");
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
        <button
          onClick={markUnderContract}
          disabled={markingUnderContract}
          className="ml-auto border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas disabled:opacity-50"
        >
          {markingUnderContract ? "…" : "Mark Under Contract"}
        </button>
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
