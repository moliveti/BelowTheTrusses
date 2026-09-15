"use client";

import { useMemo, useState } from "react";
import type { ClientOption } from "@/lib/clients/types";

const MAX_SUGGESTIONS = 8;

/** Type-ahead client picker: suggests existing clients as you type, or
 * keep typing a new name to create one. Replaces free-text client-name
 * inputs that silently upserted by exact name match. */
export function ClientPicker({
  clients,
  value,
  onChange,
  label = "Client",
}: {
  clients: ClientOption[];
  value: { id: string | null; name: string };
  onChange: (value: { id: string | null; name: string }) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.name.trim().toLowerCase();
    if (!q) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [clients, value.name]);

  const matched = value.id !== null;

  return (
    <div className="relative">
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">{label}</label>
      <input
        value={value.name}
        onChange={(e) => {
          onChange({ id: null, name: e.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Start typing a client name…"
        className="w-full border border-line px-2 py-1.5 text-xs"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-0.5 w-full border border-line bg-surface shadow-md">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ id: c.id, name: c.name });
                setOpen(false);
              }}
              className="block w-full border-b border-line px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-canvas"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <p className={`mt-1 text-[10.5px] ${matched ? "text-positive" : "text-ink/40"}`}>
        {matched
          ? "Matches existing client"
          : value.name.trim()
            ? "No match — a new client will be created"
            : "Type a client name"}
      </p>
    </div>
  );
}
