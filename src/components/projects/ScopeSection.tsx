"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ScopeTagPercent } from "@/lib/projects/types";
import { fmtUsd } from "@/lib/dashboard/format";

type FieldStatus = "idle" | "saving" | "saved" | "error";

export function ScopeSection({
  projectId,
  initialScopeTags,
  contractValue,
  projectType,
}: {
  projectId: string;
  initialScopeTags: ScopeTagPercent[];
  contractValue: number | null;
  projectType: string;
}) {
  const [scopeTags, setScopeTags] = useState(initialScopeTags);
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({});
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const clearTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const totalPercent = scopeTags.reduce((s, t) => s + (t.percentOfRevenue ?? 0), 0);
  const anyAssigned = scopeTags.some((t) => t.percentOfRevenue !== null);
  const isFullyAllocated = Math.abs(totalPercent - 1) < 0.005;

  function markSaved(key: string) {
    setFieldStatus((prev) => ({ ...prev, [key]: "saved" }));
    clearTimeout(clearTimers.current[key]);
    clearTimers.current[key] = setTimeout(() => {
      setFieldStatus((prev) => ({ ...prev, [key]: "idle" }));
    }, 2000);
  }

  async function updatePercent(scopeTagId: string, value: string) {
    setFieldStatus((prev) => ({ ...prev, [scopeTagId]: "saving" }));
    const supabase = createClient();

    if (value === "") {
      const { error } = await supabase
        .from("project_scope_tags")
        .delete()
        .eq("project_id", projectId)
        .eq("scope_tag_id", scopeTagId);
      if (error) {
        setFieldStatus((prev) => ({ ...prev, [scopeTagId]: "error" }));
        setFieldError((prev) => ({ ...prev, [scopeTagId]: error.message }));
        return;
      }
      setScopeTags((prev) => prev.map((t) => (t.id === scopeTagId ? { ...t, percentOfRevenue: null } : t)));
      markSaved(scopeTagId);
      return;
    }

    const percent = Number(value) / 100;
    const { error } = await supabase
      .from("project_scope_tags")
      .upsert({ project_id: projectId, scope_tag_id: scopeTagId, percent_of_revenue: percent });
    if (error) {
      setFieldStatus((prev) => ({ ...prev, [scopeTagId]: "error" }));
      setFieldError((prev) => ({ ...prev, [scopeTagId]: error.message }));
      return;
    }
    setScopeTags((prev) => prev.map((t) => (t.id === scopeTagId ? { ...t, percentOfRevenue: percent } : t)));
    markSaved(scopeTagId);
  }

  if (projectType !== "Residential") {
    return (
      <div className="border border-line bg-surface p-4 text-sm text-ink/50">
        Scope tracking applies to Residential projects only.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[11px] text-ink/50">
        Each category&rsquo;s share of this project&rsquo;s total contract value — should add up to 100%.
      </p>
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Category</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">% of Revenue</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">$</th>
            </tr>
          </thead>
          <tbody>
            {scopeTags.map((t) => {
              const dollarAmount = contractValue !== null && t.percentOfRevenue !== null ? contractValue * t.percentOfRevenue : null;
              return (
                <tr key={t.id} className="border-b border-line">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        defaultValue={t.percentOfRevenue !== null ? Math.round(t.percentOfRevenue * 1000) / 10 : ""}
                        onBlur={(e) => updatePercent(t.id, e.target.value)}
                        placeholder="—"
                        className="w-20 border border-line px-2 py-1 text-right text-xs"
                      />
                      <span className="text-ink/40">%</span>
                      <FieldStatusIndicator status={fieldStatus[t.id]} error={fieldError[t.id]} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink/60">
                    {dollarAmount !== null ? fmtUsd(dollarAmount) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {anyAssigned && (
            <tfoot>
              <tr className="border-t-[1.5px] border-ink font-bold">
                <td className="px-3 py-2">Total</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${isFullyAllocated ? "text-positive" : "text-warning"}`}>
                  {(totalPercent * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-ink/60">
                  {contractValue !== null ? fmtUsd(contractValue * totalPercent) : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function FieldStatusIndicator({ status, error }: { status?: FieldStatus; error?: string }) {
  if (status === "saving") {
    return <span className="w-3.5 font-mono text-[10px] text-ink/40">…</span>;
  }
  if (status === "saved") {
    return (
      <span className="w-3.5 text-xs text-brand-primary" title="Saved">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-xs text-warning" title={error ?? "Save failed"}>
        ⚠
      </span>
    );
  }
  return <span className="w-3.5" />;
}
