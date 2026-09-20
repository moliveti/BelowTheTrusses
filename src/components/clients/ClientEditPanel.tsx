"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientDetail } from "@/lib/clients/types";
import { US_STATES } from "@/lib/usStates";

type FieldStatus = "idle" | "saving" | "saved" | "error";

export function ClientEditPanel({ client }: { client: ClientDetail }) {
  const router = useRouter();
  const [name, setName] = useState(client.name);
  const [status, setStatus] = useState<Record<string, FieldStatus>>({});
  const [error, setError] = useState<Record<string, string>>({});

  async function update(column: string, value: string, refresh = false) {
    setStatus((s) => ({ ...s, [column]: "saving" }));
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("clients")
      .update({ [column]: value || null })
      .eq("id", client.id);
    if (updateError) {
      setStatus((s) => ({ ...s, [column]: "error" }));
      setError((e) => ({ ...e, [column]: updateError.message }));
      return;
    }
    setStatus((s) => ({ ...s, [column]: "saved" }));
    setError((e) => ({ ...e, [column]: "" }));
    setTimeout(() => setStatus((s) => ({ ...s, [column]: "idle" })), 2000);
    if (refresh) router.refresh();
  }

  return (
    <div>
      <div className="mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => update("name", e.target.value, true)}
          className="w-full max-w-md border border-line bg-transparent px-2 py-1 text-xl text-ink outline-none focus:border-brand-primary"
        />
        <FieldStatusLine status={status.name} error={error.name} />
      </div>

      <div className="grid grid-cols-2 gap-3 border border-line bg-surface p-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Email</label>
          <input
            defaultValue={client.email ?? ""}
            onBlur={(e) => update("email", e.target.value)}
            className="w-full border border-line px-2 py-1.5 text-xs"
          />
          <FieldStatusLine status={status.email} error={error.email} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Phone</label>
          <input
            defaultValue={client.phone ?? ""}
            onBlur={(e) => update("phone", e.target.value)}
            className="w-full border border-line px-2 py-1.5 text-xs"
          />
          <FieldStatusLine status={status.phone} error={error.phone} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Address</label>
          <input
            defaultValue={client.address ?? ""}
            onBlur={(e) => update("address", e.target.value)}
            className="w-full border border-line px-2 py-1.5 text-xs"
          />
          <FieldStatusLine status={status.address} error={error.address} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">City</label>
          <input
            defaultValue={client.city ?? ""}
            onBlur={(e) => update("city", e.target.value)}
            className="w-full border border-line px-2 py-1.5 text-xs"
          />
          <FieldStatusLine status={status.city} error={error.city} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">State</label>
          <select
            defaultValue={client.state ?? ""}
            onChange={(e) => update("state", e.target.value)}
            className="w-full border border-line px-2 py-1.5 text-xs"
          >
            <option value="">—</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </select>
          <FieldStatusLine status={status.state} error={error.state} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Zip</label>
          <input
            defaultValue={client.zip ?? ""}
            onBlur={(e) => update("zip", e.target.value)}
            className="w-full border border-line px-2 py-1.5 text-xs"
          />
          <FieldStatusLine status={status.zip} error={error.zip} />
        </div>
      </div>
    </div>
  );
}

function FieldStatusLine({ status, error }: { status?: FieldStatus; error?: string }) {
  if (status === "saving") return <span className="mt-0.5 block text-[10px] text-ink/40">Saving…</span>;
  if (status === "saved") return <span className="mt-0.5 block text-[10px] text-positive">Saved</span>;
  if (status === "error") return <span className="mt-0.5 block text-[10px] text-warning">{error ?? "Save failed"}</span>;
  return null;
}
