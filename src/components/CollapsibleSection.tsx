"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  headerExtra,
  defaultOpen = true,
  children,
}: {
  title: string;
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-ink pb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-ink"
        >
          <span className="inline-block w-3 text-[10px] text-ink/40">{open ? "▼" : "▶"}</span>
          {title}
        </button>
        {headerExtra}
      </div>
      {open && children}
    </section>
  );
}
