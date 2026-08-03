"use client";

import type { RevenueMode } from "@/lib/dashboard/types";

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: RevenueMode;
  onChange: (mode: RevenueMode) => void;
}) {
  return (
    <div className="flex gap-1">
      {(["collected", "committed"] as RevenueMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
            mode === m
              ? "bg-brand-primary text-white"
              : "border border-line text-ink/60 hover:border-brand-primary"
          }`}
        >
          {m === "collected" ? "Collected" : "Committed"}
        </button>
      ))}
    </div>
  );
}
