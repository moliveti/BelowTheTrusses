"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtUsd } from "@/lib/dashboard/format";

interface DocumentRecord {
  id: string;
  kind: "quote" | "contract";
  version: number;
  total: number | null;
  createdAt: string;
  quoteId: string | null;
  contractId: string | null;
}

const KIND_LABEL = { quote: "Quote", contract: "Contract" } as const;

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Every quote and contract PDF generated for a project, newest first, each opening the file as it was saved. */
export function DocumentsList({ projectId }: { projectId: string }) {
  const [records, setRecords] = useState<DocumentRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("generated_documents")
      .select("id, kind, version, total, created_at, quote_id, contract_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError(loadError.message);
          return;
        }
        setRecords(
          (data ?? []).map((r) => ({
            id: r.id,
            kind: r.kind,
            version: r.version,
            total: r.total,
            createdAt: r.created_at,
            quoteId: r.quote_id,
            contractId: r.contract_id,
          }))
        );
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) return <div className="border border-line bg-surface p-4 text-sm text-warning">Couldn&apos;t load documents: {error}</div>;
  if (records === null) return <div className="border border-line bg-surface p-4 text-sm text-ink/50">Loading documents…</div>;
  if (records.length === 0) {
    return (
      <div className="border border-line bg-surface p-4 text-sm text-ink/50">
        No PDFs generated yet. Each quote or contract PDF you create is saved here so you can open it again later.
      </div>
    );
  }

  const latestIdByKind = new Map<string, string>();
  for (const r of records) {
    if (!latestIdByKind.has(r.kind)) latestIdByKind.set(r.kind, r.id);
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Document</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Generated</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Total</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const isLatest = latestIdByKind.get(r.kind) === r.id;
            const regenerateHref =
              r.kind === "quote" && r.quoteId
                ? `/api/quotes/${r.quoteId}/pdf?new=1`
                : r.kind === "contract" && r.contractId
                  ? `/api/contracts/${r.contractId}/pdf?new=1`
                  : null;
            return (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2">
                  {KIND_LABEL[r.kind]} — version {r.version}
                  {isLatest && <span className="ml-2 font-mono text-[10px] uppercase text-positive">Latest</span>}
                </td>
                <td className="px-3 py-2 text-ink/70">{fmtWhen(r.createdAt)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{r.total !== null ? fmtUsd(r.total) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <a
                    href={`/api/documents/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mr-3 font-mono text-[11px] uppercase text-brand-primary underline underline-offset-2"
                  >
                    Open PDF
                  </a>
                  {isLatest && regenerateHref && (
                    <a
                      href={regenerateHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Create a fresh version from the current details, keeping this one"
                      className="font-mono text-[11px] uppercase text-ink/60 underline underline-offset-2"
                    >
                      New version
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
