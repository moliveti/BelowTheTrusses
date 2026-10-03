"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFieldStatus } from "@/hooks/useFieldStatus";
import { FieldStatusBadge } from "@/components/FieldStatusBadge";
import { fmtUsd } from "@/lib/dashboard/format";

const BILLING_METHODS = ["Fixed Fee", "Hourly", "Commission"] as const;
const STATUS_KEY = "billing";

const fmtDate = (d: string | null) => d ?? "—";

export function BillingSection({
  projectId,
  billingMethod,
  hourlyRate,
  fixedFeeAmount,
  contractSignedDate,
  addonHours,
  addonHourlyRate,
  furnitureCommissionRate,
}: {
  projectId: string;
  billingMethod: string | null;
  hourlyRate: number | null;
  fixedFeeAmount: number | null;
  contractSignedDate: string | null;
  addonHours: number | null;
  addonHourlyRate: number | null;
  furnitureCommissionRate: number | null;
}) {
  const router = useRouter();
  const { status, error, run } = useFieldStatus();

  const [saved, setSaved] = useState({
    billingMethod: billingMethod ?? "Fixed Fee",
    hourlyRate: hourlyRate !== null ? String(hourlyRate) : "",
    fixedFeeAmount: fixedFeeAmount !== null ? String(fixedFeeAmount) : "",
  });
  const [draft, setDraft] = useState(saved);

  const dirty =
    draft.billingMethod !== saved.billingMethod ||
    draft.hourlyRate !== saved.hourlyRate ||
    draft.fixedFeeAmount !== saved.fixedFeeAmount;

  async function save() {
    const supabase = createClient();
    const ok = await run(STATUS_KEY, async () => {
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          billing_method: draft.billingMethod,
          hourly_rate: draft.hourlyRate.trim() === "" ? null : Number(draft.hourlyRate),
          fixed_fee_amount: draft.fixedFeeAmount.trim() === "" ? null : Number(draft.fixedFeeAmount),
        })
        .eq("id", projectId);
      return { error: updateError?.message ?? null };
    });
    if (ok) {
      setSaved(draft);
      router.refresh();
    }
  }

  return (
    <div className="border border-line bg-surface p-4 text-sm">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink/50">Billing Method</div>
          <select
            value={draft.billingMethod}
            onChange={(e) => setDraft((d) => ({ ...d, billingMethod: e.target.value }))}
            className="mt-0.5 w-full border border-line px-2 py-1 text-sm outline-none focus:border-brand-primary"
          >
            {BILLING_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <Field label="Contract Signed" value={fmtDate(contractSignedDate)} />

        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink/50">Hourly Rate</div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.hourlyRate}
            onChange={(e) => setDraft((d) => ({ ...d, hourlyRate: e.target.value }))}
            placeholder="—"
            className="mt-0.5 w-full border border-line px-2 py-1 text-sm outline-none focus:border-brand-primary"
          />
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink/50">Fixed Fee</div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.fixedFeeAmount}
            onChange={(e) => setDraft((d) => ({ ...d, fixedFeeAmount: e.target.value }))}
            placeholder="—"
            className="mt-0.5 w-full border border-line px-2 py-1 text-sm outline-none focus:border-brand-primary"
          />
        </div>

        <Field
          label="Add-on Hours"
          value={addonHours !== null ? `${addonHours} hrs @ ${fmtUsd(addonHourlyRate ?? 0)}/hr` : "—"}
        />
        <Field
          label="Furniture Commission"
          value={furnitureCommissionRate !== null ? `${(furnitureCommissionRate * 100).toFixed(0)}% (reference only)` : "—"}
        />
      </div>

      <div className="mt-4 flex items-center gap-1 border-t border-line pt-3">
        <button
          onClick={save}
          disabled={!dirty || status[STATUS_KEY] === "saving"}
          className="bg-brand-primary px-3 py-1.5 font-mono text-[11px] uppercase text-white hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {status[STATUS_KEY] === "saving" ? "Saving…" : "Save Changes"}
        </button>
        <FieldStatusBadge status={status[STATUS_KEY]} error={error[STATUS_KEY]} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink/50">{label}</div>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}
