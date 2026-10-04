"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/leads/types";
import {
  deleteLead,
  deleteQuoteOnly,
  previewLeadDeletion,
  type DeleteSummary,
  type LeadDeletionPreview,
} from "@/lib/records/delete";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export function DeleteLeadDialog({
  lead,
  mode,
  onClose,
  onDeleted,
}: {
  lead: Lead;
  mode: "lead" | "quote";
  onClose: () => void;
  onDeleted: (summary: DeleteSummary) => void;
}) {
  const [preview, setPreview] = useState<LeadDeletionPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    previewLeadDeletion(createClient(), lead.id, lead.convertedProjectId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setPreviewError(result.error);
      else setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.convertedProjectId]);

  async function confirm() {
    setBusy(true);
    setError("");
    const db = createClient();
    const result = mode === "lead" ? await deleteLead(db, lead.id) : await deleteQuoteOnly(db, lead.id);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onDeleted(result);
  }

  const removes: string[] = [];
  const keeps: string[] = [];
  if (preview) {
    if (mode === "lead") removes.push(`The lead "${lead.name}"`);
    if (preview.quoteCount > 0) {
      removes.push(preview.quoteCount === 1 ? "Its quote (and all quote line items)" : `Its ${preview.quoteCount} quotes (and all quote line items)`);
    }
    for (const name of preview.willDeleteProjects) {
      removes.push(`Project "${name}" — it only exists because of this quote (no contract, hours, or payments)`);
    }
    if (preview.hasProposal && (mode === "lead" || preview.willKeepProjects.length === 0)) {
      removes.push("Its open proposal in Business Not Materialized");
    }
    if (mode === "quote" && preview.willKeepProjects.length === 0 && preview.quoteCount > 0) {
      keeps.push(`The lead "${lead.name}" — it goes back to New Prospect`);
    }
    if (mode === "quote" && preview.willKeepProjects.length > 0) {
      keeps.push(`The lead "${lead.name}" and its status`);
    }
    for (const p of preview.willKeepProjects) {
      keeps.push(`Project "${p.name}"${p.reasons.length > 0 ? ` — ${p.reasons.join(", ")}` : ""}`);
    }
  }

  const noQuote = mode === "quote" && preview !== null && preview.quoteCount === 0;
  const blockedReasons = previewError
    ? [previewError]
    : noQuote
      ? ["This lead has no quote to delete."]
      : undefined;

  return (
    <ConfirmDeleteDialog
      title={mode === "lead" ? `Delete lead — ${lead.name}?` : `Delete quote — ${lead.name}?`}
      loading={preview === null && !previewError}
      removes={removes}
      keeps={keeps}
      blockedReasons={blockedReasons}
      blockedIntro={previewError ? "Couldn't check what's linked to this lead:" : "Nothing to do:"}
      blockedNote=""
      confirmLabel={mode === "lead" ? "Delete Lead" : "Delete Quote"}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
