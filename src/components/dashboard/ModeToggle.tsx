"use client";

import type { RevenueMode } from "@/lib/dashboard/types";

const LABELS: Record<RevenueMode, string> = {
  revenue: "Revenue",
  revenue_forecast: "Revenue + Forecast",
};

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: RevenueMode;
  onChange: (mode: RevenueMode) => void;
}) {
  return (
    <div className="flex gap-1">
      {(["revenue", "revenue_forecast"] as RevenueMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
            mode === m
              ? "bg-brand-primary text-white"
              : "border border-line text-ink/60 hover:border-brand-primary"
          }`}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}
