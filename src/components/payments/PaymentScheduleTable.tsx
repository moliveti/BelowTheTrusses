"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PaymentRow } from "@/lib/payments/types";
import { fmtUsd } from "@/lib/dashboard/format";
import { useFieldStatus } from "@/hooks/useFieldStatus";
import { FieldStatusBadge } from "@/components/FieldStatusBadge";

const STATUSES = ["Pending", "Invoiced", "Paid", "Overdue"] as const;
type ActiveFilter = "all" | "active" | "inactive";
type DueFilter = "due" | "paid" | "all";
const NO_DUE_DATE = "No Due Date";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function pendingAmount(r: PaymentRow): number {
  return Math.max(0, (r.amountDue ?? 0) - (r.amountPaid ?? 0));
}

function yearOf(r: PaymentRow): string {
  return r.dueDate ? r.dueDate.slice(0, 4) : NO_DUE_DATE;
}

// Current year first, then the rest oldest-to-newest (so past years lead
// into future years, which trail off at the bottom); "No Due Date" always
// last.
function compareYears(a: string, b: string, currentYear: string): number {
  if (a === NO_DUE_DATE) return 1;
  if (b === NO_DUE_DATE) return -1;
  if (a === currentYear) return -1;
  if (b === currentYear) return 1;
  return a.localeCompare(b);
}

export function PaymentScheduleTable({ payments }: { payments: PaymentRow[] }) {
  const [rows, setRows] = useState(payments);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("due");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const fieldStatus = useFieldStatus();

  const currentYear = String(new Date().getFullYear());

  const years = useMemo(() => {
    const set = new Set(rows.map(yearOf).filter((y) => y !== NO_DUE_DATE));
    return Array.from(set).sort((a, b) => compareYears(a, b, currentYear));
  }, [rows, currentYear]);

  // Search/project-status/year narrow what's in view entirely; the Due/Paid
  // toggle only hides rows from the table below -- summary tiles stay on
  // this broader scope so "Total Paid" doesn't vanish just because the
  // table defaults to showing what's still owed.
  const scoped = useMemo(
    () =>
      rows.filter((r) => {
        const q = search.toLowerCase();
        return (
          (q === "" || r.projectName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q)) &&
          (activeFilter === "all" || (activeFilter === "active") === r.projectActive) &&
          (yearFilter === "all" || yearOf(r) === yearFilter)
        );
      }),
    [rows, search, activeFilter, yearFilter]
  );

  // The summary tiles always show All Time + current-year (YTD) side by
  // side, independent of the Year pill above (which only scopes the table) --
  // search/project-status still narrow them the same way "scoped" does.
  const allTimeRows = useMemo(
    () =>
      rows.filter((r) => {
        const q = search.toLowerCase();
        return (
          (q === "" || r.projectName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q)) &&
          (activeFilter === "all" || (activeFilter === "active") === r.projectActive)
        );
      }),
    [rows, search, activeFilter]
  );
  const ytdRows = useMemo(() => allTimeRows.filter((r) => yearOf(r) === currentYear), [allTimeRows, currentYear]);

  const tableRows = useMemo(
    () =>
      scoped.filter((r) => {
        if (dueFilter === "all") return true;
        const pending = pendingAmount(r);
        return dueFilter === "due" ? pending > 0 : pending === 0;
      }),
    [scoped, dueFilter]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    for (const r of tableRows) {
      const y = yearOf(r);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.dueDate ?? "9999-99").localeCompare(b.dueDate ?? "9999-99"));
    }
    const sortedYears = Array.from(map.keys()).sort((a, b) => compareYears(a, b, currentYear));
    return sortedYears.map((year) => ({ year, rows: map.get(year)! }));
  }, [tableRows, currentYear]);

  function patchRow(id: string, patch: Partial<PaymentRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // Same auto-fill-on-Paid fix as the per-project Milestones & Payments
  // section: marking Paid (via status) or setting a Paid Date with no
  // amount recorded yet fills amount_paid so balances don't stay stuck
  // showing as outstanding.
  async function updateField(r: PaymentRow, column: string, value: string, patch: Partial<PaymentRow>) {
    const key = `${r.id}:${column}`;
    const payload: Record<string, string | number | null> = { [column]: value || null };
    let finalPatch = patch;

    const becomingPaidStatus = column === "status" && value === "Paid";
    const gettingPaidDate = column === "paid_date" && value !== "";
    if ((becomingPaidStatus || gettingPaidDate) && r.amountPaid === null) {
      const amount = r.amountDue ?? 0;
      payload.amount_paid = amount;
      finalPatch = { ...finalPatch, amountPaid: amount };
      if (becomingPaidStatus && !r.paidDate) {
        const today = todayIso();
        payload.paid_date = today;
        finalPatch = { ...finalPatch, paidDate: today };
      }
    }

    const supabase = createClient();
    const ok = await fieldStatus.run(key, async () => {
      const { error } = await supabase.from("milestones").update(payload).eq("id", r.id);
      return { error: error?.message ?? null };
    });
    if (ok) patchRow(r.id, finalPatch);
  }

  async function markPaid(r: PaymentRow) {
    const key = `${r.id}:pay`;
    const today = todayIso();
    const amount = r.amountPaid ?? r.amountDue ?? 0;
    const supabase = createClient();
    const ok = await fieldStatus.run(key, async () => {
      const { error } = await supabase
        .from("milestones")
        .update({ paid_date: today, amount_paid: amount, status: "Paid" })
        .eq("id", r.id);
      return { error: error?.message ?? null };
    });
    if (ok) patchRow(r.id, { paidDate: today, amountPaid: amount, status: "Paid" });
  }

  const allTimeDue = allTimeRows.reduce((s, r) => s + (r.amountDue ?? 0), 0);
  const allTimePaid = allTimeRows.reduce((s, r) => s + (r.amountPaid ?? 0), 0);
  const allTimePending = allTimeRows.reduce((s, r) => s + pendingAmount(r), 0);
  const ytdDue = ytdRows.reduce((s, r) => s + (r.amountDue ?? 0), 0);
  const ytdPaid = ytdRows.reduce((s, r) => s + (r.amountPaid ?? 0), 0);
  const ytdPending = ytdRows.reduce((s, r) => s + pendingAmount(r), 0);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Payment Schedules</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
          Every Project's Payments, by Year &amp; Due Date
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <input
          type="text"
          placeholder="Search project or client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
        />
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/50">Year</div>
          <div className="flex flex-wrap gap-1">
            <PillButton active={yearFilter === "all"} onClick={() => setYearFilter("all")}>
              All Years
            </PillButton>
            {years.map((y) => (
              <PillButton key={y} active={yearFilter === y} onClick={() => setYearFilter(y)}>
                {y}
              </PillButton>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/50">Show</div>
          <div className="flex flex-wrap gap-1">
            <PillButton active={dueFilter === "due"} onClick={() => setDueFilter("due")}>
              Due
            </PillButton>
            <PillButton active={dueFilter === "paid"} onClick={() => setDueFilter("paid")}>
              Paid
            </PillButton>
            <PillButton active={dueFilter === "all"} onClick={() => setDueFilter("all")}>
              All
            </PillButton>
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/50">Project Status</div>
          <div className="flex flex-wrap gap-1">
            {(["all", "active", "inactive"] as ActiveFilter[]).map((f) => (
              <PillButton key={f} active={activeFilter === f} onClick={() => setActiveFilter(f)}>
                {f}
              </PillButton>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <SummaryStat label="Total Revenue" allTime={fmtUsd(allTimeDue)} ytd={fmtUsd(ytdDue)} ytdYear={currentYear} />
        <SummaryStat label="Total Paid" allTime={fmtUsd(allTimePaid)} ytd={fmtUsd(ytdPaid)} ytdYear={currentYear} />
        <SummaryStat
          label="Total Pending"
          allTime={fmtUsd(allTimePending)}
          ytd={fmtUsd(ytdPending)}
          ytdYear={currentYear}
          accent={allTimePending > 0}
        />
      </div>

      {grouped.length === 0 ? (
        <div className="border border-line bg-surface p-4 text-sm text-ink/50">No payments match.</div>
      ) : (
        grouped.map((group) => (
          <div key={group.year} className="mb-6">
            <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/60">
              {group.year} <span className="text-ink/40">({group.rows.length})</span>
            </h3>
            <div className="overflow-x-auto border border-line bg-surface">
              <table className="w-full min-w-[920px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th className="px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
                    <th className="px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Client</th>
                    <th className="px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Payment</th>
                    <th className="px-2 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Due</th>
                    <th className="px-2 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Due $</th>
                    <th className="px-2 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid</th>
                    <th className="px-2 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid $</th>
                    <th className="px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Status</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((r) => (
                    <tr key={r.id} className="border-b border-line hover:bg-canvas">
                      <td className="px-2 py-2">
                        <Link
                          href={`/projects/${r.projectId}`}
                          className="text-brand-primary underline decoration-brand-primary/30 underline-offset-2 hover:decoration-brand-primary"
                        >
                          {r.projectName}
                        </Link>
                        {!r.projectActive && <div className="font-mono text-[9.5px] uppercase text-ink/40">Inactive</div>}
                      </td>
                      <td className="px-2 py-2 text-ink/70">{r.clientName}</td>
                      <td className="px-2 py-2">{r.name}</td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="date"
                          defaultValue={r.dueDate ?? ""}
                          onBlur={(e) => updateField(r, "due_date", e.target.value, { dueDate: e.target.value || null })}
                          className="w-[7.5rem] border border-line px-1 py-1 text-right text-xs"
                        />
                        <FieldStatusBadge status={fieldStatus.status[`${r.id}:due_date`]} error={fieldStatus.error[`${r.id}:due_date`]} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          defaultValue={r.amountDue ?? ""}
                          onBlur={(e) =>
                            updateField(r, "amount_due", e.target.value, {
                              amountDue: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="w-16 border border-line px-1 py-1 text-right text-xs"
                        />
                        <FieldStatusBadge status={fieldStatus.status[`${r.id}:amount_due`]} error={fieldStatus.error[`${r.id}:amount_due`]} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="date"
                          defaultValue={r.paidDate ?? ""}
                          onBlur={(e) => updateField(r, "paid_date", e.target.value, { paidDate: e.target.value || null })}
                          className="w-[7.5rem] border border-line px-1 py-1 text-right text-xs"
                        />
                        <FieldStatusBadge status={fieldStatus.status[`${r.id}:paid_date`]} error={fieldStatus.error[`${r.id}:paid_date`]} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          defaultValue={r.amountPaid ?? ""}
                          onBlur={(e) =>
                            updateField(r, "amount_paid", e.target.value, {
                              amountPaid: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="w-16 border border-line px-1 py-1 text-right text-xs"
                        />
                        <FieldStatusBadge status={fieldStatus.status[`${r.id}:amount_paid`]} error={fieldStatus.error[`${r.id}:amount_paid`]} />
                      </td>
                      <td className="px-2 py-2 text-left">
                        <select
                          value={r.status}
                          onChange={(e) => updateField(r, "status", e.target.value, { status: e.target.value })}
                          className="w-[5.5rem] border border-line px-1 py-1 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <FieldStatusBadge status={fieldStatus.status[`${r.id}:status`]} error={fieldStatus.error[`${r.id}:status`]} />
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {r.status !== "Paid" && (
                          <button
                            onClick={() => markPaid(r)}
                            title="Mark Paid"
                            className="font-mono text-[10px] text-positive underline underline-offset-2"
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide ${
        active ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryStat({
  label,
  allTime,
  ytd,
  ytdYear,
  accent,
}: {
  label: string;
  allTime: string;
  ytd: string;
  ytdYear: string;
  accent?: boolean;
}) {
  const valueClass = accent ? "text-warning" : "text-ink";
  return (
    <div className="border border-line border-t-2 border-t-brand-accent bg-surface p-4">
      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{label}</div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">All Time (Since 2024)</span>
        <span className={`font-mono text-lg tabular-nums ${valueClass}`}>{allTime}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">YTD ({ytdYear})</span>
        <span className={`font-mono text-lg tabular-nums ${valueClass}`}>{ytd}</span>
      </div>
    </div>
  );
}
