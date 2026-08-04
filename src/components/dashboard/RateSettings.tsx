"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectTypeName, SubcontractorRates } from "@/lib/hours/types";

const TYPES: ProjectTypeName[] = ["Residential", "Commercial", "Furniture"];

export function RateSettings({ initialRates }: { initialRates: SubcontractorRates[] }) {
  const [rates, setRates] = useState(initialRates);

  async function updateDefault(subcontractorId: string, value: string) {
    const num = value === "" ? null : Number(value);
    const supabase = createClient();
    const { error } = await supabase.from("subcontractors").update({ default_hourly_rate: num }).eq("id", subcontractorId);
    if (!error) {
      setRates((prev) => prev.map((r) => (r.id === subcontractorId ? { ...r, defaultHourlyRate: num } : r)));
    }
  }

  async function updateTypeRate(subcontractorId: string, type: ProjectTypeName, value: string) {
    const supabase = createClient();
    if (value === "") {
      const { error } = await supabase
        .from("subcontractor_type_rates")
        .delete()
        .eq("subcontractor_id", subcontractorId)
        .eq("project_type", type);
      if (!error) {
        setRates((prev) =>
          prev.map((r) => {
            if (r.id !== subcontractorId) return r;
            const typeRates = { ...r.typeRates };
            delete typeRates[type];
            return { ...r, typeRates };
          })
        );
      }
      return;
    }
    const num = Number(value);
    const { error } = await supabase
      .from("subcontractor_type_rates")
      .upsert({ subcontractor_id: subcontractorId, project_type: type, hourly_rate: num });
    if (!error) {
      setRates((prev) =>
        prev.map((r) => (r.id === subcontractorId ? { ...r, typeRates: { ...r.typeRates, [type]: num } } : r))
      );
    }
  }

  return (
    <div className="border border-line bg-surface p-4">
      <p className="mb-3 text-[11px] text-ink/50">
        Default rate applies unless a type-specific rate is set for that person. New project assignments
        auto-fill from these — owner/staff only.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Default $/hr
              </th>
              {TYPES.map((t) => (
                <th key={t} className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                  {t} $/hr
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    defaultValue={r.defaultHourlyRate ?? ""}
                    onBlur={(e) => updateDefault(r.id, e.target.value)}
                    className="w-20 border border-line px-2 py-1 text-right text-xs"
                  />
                </td>
                {TYPES.map((t) => (
                  <td key={t} className="px-3 py-2 text-right">
                    <input
                      type="number"
                      defaultValue={r.typeRates[t] ?? ""}
                      onBlur={(e) => updateTypeRate(r.id, t, e.target.value)}
                      placeholder="—"
                      className="w-20 border border-line px-2 py-1 text-right text-xs"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
