"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectTypeName, SubcontractorRates } from "@/lib/hours/types";

const TYPES: ProjectTypeName[] = ["Residential", "Commercial", "Furniture"];

type FieldStatus = "idle" | "saving" | "saved" | "error";

export function RateSettings({ initialRates }: { initialRates: SubcontractorRates[] }) {
  const [rates, setRates] = useState(initialRates);
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({});
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const clearTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function markSaved(key: string) {
    setFieldStatus((prev) => ({ ...prev, [key]: "saved" }));
    clearTimeout(clearTimers.current[key]);
    clearTimers.current[key] = setTimeout(() => {
      setFieldStatus((prev) => ({ ...prev, [key]: "idle" }));
    }, 2000);
  }

  function markError(key: string, message: string) {
    setFieldStatus((prev) => ({ ...prev, [key]: "error" }));
    setFieldError((prev) => ({ ...prev, [key]: message }));
  }

  async function updateDefault(subcontractorId: string, value: string) {
    const key = `${subcontractorId}:default`;
    const num = value === "" ? null : Number(value);
    setFieldStatus((prev) => ({ ...prev, [key]: "saving" }));
    const supabase = createClient();
    const { error } = await supabase.from("subcontractors").update({ default_hourly_rate: num }).eq("id", subcontractorId);
    if (error) {
      markError(key, error.message);
      return;
    }
    setRates((prev) => prev.map((r) => (r.id === subcontractorId ? { ...r, defaultHourlyRate: num } : r)));
    markSaved(key);
  }

  async function updateTypeRate(subcontractorId: string, type: ProjectTypeName, value: string) {
    const key = `${subcontractorId}:${type}`;
    setFieldStatus((prev) => ({ ...prev, [key]: "saving" }));
    const supabase = createClient();
    if (value === "") {
      const { error } = await supabase
        .from("subcontractor_type_rates")
        .delete()
        .eq("subcontractor_id", subcontractorId)
        .eq("project_type", type);
      if (error) {
        markError(key, error.message);
        return;
      }
      setRates((prev) =>
        prev.map((r) => {
          if (r.id !== subcontractorId) return r;
          const typeRates = { ...r.typeRates };
          delete typeRates[type];
          return { ...r, typeRates };
        })
      );
      markSaved(key);
      return;
    }
    const num = Number(value);
    const { error } = await supabase
      .from("subcontractor_type_rates")
      .upsert({ subcontractor_id: subcontractorId, project_type: type, hourly_rate: num });
    if (error) {
      markError(key, error.message);
      return;
    }
    setRates((prev) =>
      prev.map((r) => (r.id === subcontractorId ? { ...r, typeRates: { ...r.typeRates, [type]: num } } : r))
    );
    markSaved(key);
  }

  return (
    <div className="border border-line bg-surface p-4">
      <p className="mb-3 text-[11px] text-ink/50">
        Default rate applies unless a type-specific rate is set for that person. New project assignments
        auto-fill from these — owner/staff only. Changes here save immediately but only affect hours
        logged from now on; already-logged hours keep the rate that applied when they were entered.
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
            {rates.map((r) => {
              const defaultKey = `${r.id}:default`;
              return (
                <tr key={r.id} className="border-b border-line">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <input
                        type="number"
                        defaultValue={r.defaultHourlyRate ?? ""}
                        onBlur={(e) => updateDefault(r.id, e.target.value)}
                        className="w-20 border border-line px-2 py-1 text-right text-xs"
                      />
                      <FieldStatusIndicator status={fieldStatus[defaultKey]} error={fieldError[defaultKey]} />
                    </div>
                  </td>
                  {TYPES.map((t) => {
                    const typeKey = `${r.id}:${t}`;
                    return (
                      <td key={t} className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            defaultValue={r.typeRates[t] ?? ""}
                            onBlur={(e) => updateTypeRate(r.id, t, e.target.value)}
                            placeholder="—"
                            className="w-20 border border-line px-2 py-1 text-right text-xs"
                          />
                          <FieldStatusIndicator status={fieldStatus[typeKey]} error={fieldError[typeKey]} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
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
