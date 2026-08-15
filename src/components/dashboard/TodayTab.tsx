"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecommendationRow } from "@/lib/intelligence/queries";
import type { Signal } from "@/lib/intelligence/types";
import { topPriorities } from "@/lib/intelligence/rank";
import { toIsoDate } from "@/lib/hours/dates";
import type { SowRow } from "@/lib/dashboard/types";
import type { ProjectListItem } from "@/lib/projects/types";
import type { Assignment, ProjectOption, SubcontractorOption } from "@/lib/hours/types";
import { fmtUsd } from "@/lib/dashboard/format";

export interface MonthStats {
  yoyDeltaPct: number | null;
  topReferralName: string | null;
  topReferralSharePct: number | null;
}

// Mirrors AGING_SOW_STATUSES in lib/intelligence/facts.ts — duplicated
// rather than imported so this client component doesn't pull in that
// module's server-only (node:crypto) fingerprinting dependency.
const OPEN_SOW_STATUSES = ["Open", "On Hold", "No Response"];

type SubPeriod = "today" | "week" | "month";
type Urgency = "red" | "yellow" | "green";

/**
 * Presentation-only urgency, separate from the stored `severity` (which
 * still drives ranking/lifecycle persistence). Date-driven items map
 * directly to when they're due; everything else falls back to severity.
 * One consistent 3-color scale across every recommendation type, per the
 * owner's request for "a key for colors so we know what they mean."
 */
function urgencyOf(rec: Pick<RecommendationRow, "type" | "severity" | "context">): Urgency {
  switch (rec.type) {
    case "milestone_overdue":
      return "red";
    case "milestone_due_this_week":
      return "yellow";
    case "milestone_due_this_month":
      return "green";
    case "contractor_hours_pending":
      return rec.severity === "high" ? "red" : "yellow";
    case "aging_sow":
      return rec.context.closeoutSuggested ? "red" : rec.severity === "high" ? "yellow" : "green";
    default:
      return rec.severity === "critical" ? "red" : rec.severity === "high" ? "yellow" : "green";
  }
}

const URGENCY_STYLE: Record<Urgency, { border: string; text: string; dot: string }> = {
  red: { border: "border-l-warning", text: "text-warning", dot: "bg-warning" },
  yellow: { border: "border-l-brand-accent", text: "text-brand-accent", dot: "bg-brand-accent" },
  green: { border: "border-l-positive", text: "text-positive", dot: "bg-positive" },
};

const URGENCY_LABEL: Record<Urgency, string> = { red: "Act Now", yellow: "This Week", green: "This Month" };

function ColorKey() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 border border-line bg-surface px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Key</span>
      {(["red", "yellow", "green"] as Urgency[]).map((u) => (
        <span key={u} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${URGENCY_STYLE[u].dot}`} />
          <span className="text-xs text-ink/70">
            {URGENCY_LABEL[u]}
            {u === "red" ? " — overdue or needs a decision" : u === "yellow" ? " — due within 7 days" : " — due later this month, on your radar"}
          </span>
        </span>
      ))}
    </div>
  );
}

function openHref(rec: Pick<RecommendationRow, "sourceTable" | "sourceId" | "context">): string {
  const projectId = typeof rec.context.projectId === "string" ? rec.context.projectId : null;
  switch (rec.sourceTable) {
    case "leads":
      return "/?tab=leads";
    case "sow_sent":
      return "/?tab=sow";
    case "milestones":
      return projectId ? `/projects/${projectId}` : "/?tab=projects";
    case "projects":
      return `/projects/${rec.sourceId}`;
    case "subcontractor_time_entries":
      return "/?tab=contracted";
    default:
      return "/";
  }
}

async function logActivity(
  supabase: ReturnType<typeof createClient>,
  params: {
    entityTable: string;
    entityId: string;
    eventType: string;
    summary: string;
    priorValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    recommendationId: string;
  }
) {
  await supabase.from("activity_events").insert({
    entity_table: params.entityTable,
    entity_id: params.entityId,
    event_type: params.eventType,
    summary: params.summary,
    prior_value: params.priorValue ?? null,
    new_value: params.newValue ?? null,
    source: "today",
    recommendation_id: params.recommendationId,
  });
}

export function TodayTab({
  recommendations: initial,
  weeklyExtras,
  monthStats,
  projects,
  sowRows,
  assignments,
  assignmentProjects,
  assignmentSubcontractors,
}: {
  recommendations: RecommendationRow[];
  weeklyExtras: Signal[];
  monthStats: MonthStats;
  projects: ProjectListItem[];
  sowRows: SowRow[];
  assignments: Assignment[];
  assignmentProjects: ProjectOption[];
  assignmentSubcontractors: SubcontractorOption[];
}) {
  const [period, setPeriod] = useState<SubPeriod>("today");
  const [recommendations, setRecommendations] = useState(initial);
  const router = useRouter();

  function remove(id: string) {
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }

  const top = useMemo(() => topPriorities(recommendations, 5), [recommendations]);
  const rest = useMemo(() => {
    const topIds = new Set(top.map((r) => r.id));
    return recommendations.filter((r) => !topIds.has(r.id));
  }, [recommendations, top]);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Priorities</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">What Should We Do?</span>
      </div>

      <nav className="mb-6 flex gap-1">
        {(["today", "week", "month"] as SubPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wide ${
              period === p ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
            }`}
          >
            {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
          </button>
        ))}
      </nav>

      {period === "today" && (
        <>
          <KpiStrip
            recommendations={recommendations}
            projects={projects}
            sowRows={sowRows}
            assignments={assignments}
            assignmentProjects={assignmentProjects}
            assignmentSubcontractors={assignmentSubcontractors}
            onHandled={remove}
            router={router}
          />

          <ColorKey />

          <section className="mb-8">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Top Priorities Today</h3>
            {top.length === 0 ? (
              <div className="border border-line bg-surface p-4 text-sm text-ink/50">
                Nothing needs attention right now — check back tomorrow.
              </div>
            ) : (
              <div className="space-y-2">
                {top.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onHandled={remove} router={router} />
                ))}
              </div>
            )}
          </section>

          {rest.length > 0 && (
            <section>
              <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">
                Also Worth a Look ({rest.length})
              </h3>
              <div className="space-y-2">
                {rest.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onHandled={remove} router={router} compact />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {period === "week" && (
        <WeekView recommendations={recommendations} weeklyExtras={weeklyExtras} onHandled={remove} router={router} />
      )}
      {period === "month" && (
        <MonthView recommendations={recommendations} weeklyExtras={weeklyExtras} stats={monthStats} onHandled={remove} router={router} />
      )}
    </div>
  );
}

type KpiKey = "projects" | "quotes" | "overdue" | "dueThisWeek" | "hours";

function KpiTile({
  active,
  onClick,
  label,
  value,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`border border-line border-t-2 bg-surface p-4 text-left transition ${
        active ? "border-t-brand-primary bg-canvas" : "border-t-brand-accent hover:bg-canvas"
      }`}
    >
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{label}</div>
      <div className="font-mono text-lg tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink/50">{sub}</div>}
    </button>
  );
}

function KpiStrip({
  recommendations,
  projects,
  sowRows,
  assignments,
  assignmentProjects,
  assignmentSubcontractors,
  onHandled,
  router,
}: {
  recommendations: RecommendationRow[];
  projects: ProjectListItem[];
  sowRows: SowRow[];
  assignments: Assignment[];
  assignmentProjects: ProjectOption[];
  assignmentSubcontractors: SubcontractorOption[];
  onHandled: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [expanded, setExpanded] = useState<KpiKey | null>(null);

  const activeProjects = useMemo(() => projects.filter((p) => p.active), [projects]);

  const openQuotes = useMemo(() => sowRows.filter((r) => OPEN_SOW_STATUSES.includes(r.status)), [sowRows]);
  const quotesSentThisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return openQuotes.filter((r) => r.dateSent !== null && new Date(r.dateSent) >= cutoff);
  }, [openQuotes]);

  const overdue = useMemo(() => recommendations.filter((r) => r.type === "milestone_overdue"), [recommendations]);
  const overdueTotal = useMemo(
    () => overdue.reduce((sum, r) => sum + (typeof r.context.outstanding === "number" ? r.context.outstanding : r.metricValue ?? 0), 0),
    [overdue]
  );

  const dueThisWeek = useMemo(() => recommendations.filter((r) => r.type === "milestone_due_this_week"), [recommendations]);
  const dueThisWeekTotal = useMemo(
    () => dueThisWeek.reduce((sum, r) => sum + (typeof r.context.outstanding === "number" ? r.context.outstanding : r.metricValue ?? 0), 0),
    [dueThisWeek]
  );

  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);
  const committedAssignments = useMemo(
    () => assignments.filter((a) => activeProjectIds.has(a.projectId) && (a.allocatedHours ?? 0) > 0),
    [assignments, activeProjectIds]
  );
  const committedHoursTotal = useMemo(
    () => committedAssignments.reduce((sum, a) => sum + (a.allocatedHours ?? 0), 0),
    [committedAssignments]
  );
  const projectNameById = useMemo(() => new Map(assignmentProjects.map((p) => [p.id, p.name])), [assignmentProjects]);
  const subcontractorNameById = useMemo(
    () => new Map(assignmentSubcontractors.map((s) => [s.id, s.name])),
    [assignmentSubcontractors]
  );

  function toggle(key: KpiKey) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiTile
          active={expanded === "projects"}
          onClick={() => toggle("projects")}
          label="Active Projects"
          value={String(activeProjects.length)}
        />
        <KpiTile
          active={expanded === "quotes"}
          onClick={() => toggle("quotes")}
          label="Outstanding Quotes"
          value={String(openQuotes.length)}
          sub={`${quotesSentThisWeek.length} sent this week`}
        />
        <KpiTile
          active={expanded === "overdue"}
          onClick={() => toggle("overdue")}
          label="Overdue Balances"
          value={String(overdue.length)}
          sub={fmtUsd(overdueTotal)}
        />
        <KpiTile
          active={expanded === "dueThisWeek"}
          onClick={() => toggle("dueThisWeek")}
          label="Payments Due This Week"
          value={String(dueThisWeek.length)}
          sub={fmtUsd(dueThisWeekTotal)}
        />
        <KpiTile
          active={expanded === "hours"}
          onClick={() => toggle("hours")}
          label="Hours Committed"
          value={committedHoursTotal.toFixed(0)}
          sub={`${committedAssignments.length} assignment${committedAssignments.length === 1 ? "" : "s"}`}
        />
      </div>

      {expanded && (
        <div className="mt-3 border border-line bg-surface p-4">
          {expanded === "projects" &&
            (activeProjects.length === 0 ? (
              <p className="text-sm text-ink/50">No active projects.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {activeProjects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="text-brand-primary underline underline-offset-2">
                      {p.name}
                    </Link>
                    <span className="text-ink/50"> — {p.clientName} · {p.type}</span>
                  </li>
                ))}
              </ul>
            ))}

          {expanded === "quotes" &&
            (openQuotes.length === 0 ? (
              <p className="text-sm text-ink/50">No open quotes.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {openQuotes.map((r) => {
                  const sentThisWeek = quotesSentThisWeek.some((q) => q.id === r.id);
                  return (
                    <li key={r.id}>
                      <span>{r.prospectName}</span>
                      <span className="text-ink/50">
                        {" "}
                        — {r.status}
                        {r.proposedFee !== null ? ` · ${fmtUsd(r.proposedFee)}` : ""}
                        {r.dateSent ? ` · sent ${r.dateSent}` : ""}
                      </span>
                      {sentThisWeek && (
                        <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-wide text-brand-accent">
                          This Week
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}

          {expanded === "overdue" &&
            (overdue.length === 0 ? (
              <p className="text-sm text-ink/50">No overdue balances.</p>
            ) : (
              <div className="space-y-2">
                {overdue.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onHandled={onHandled} router={router} compact />
                ))}
              </div>
            ))}

          {expanded === "dueThisWeek" &&
            (dueThisWeek.length === 0 ? (
              <p className="text-sm text-ink/50">Nothing due this week.</p>
            ) : (
              <div className="space-y-2">
                {dueThisWeek.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onHandled={onHandled} router={router} compact />
                ))}
              </div>
            ))}

          {expanded === "hours" &&
            (committedAssignments.length === 0 ? (
              <p className="text-sm text-ink/50">No allocated hours on active projects.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {committedAssignments.map((a) => (
                  <li key={`${a.projectId}-${a.subcontractorId}`}>
                    <span>{subcontractorNameById.get(a.subcontractorId) ?? "Unknown"}</span>
                    <span className="text-ink/50">
                      {" "}
                      — {projectNameById.get(a.projectId) ?? "Unknown project"} · {(a.allocatedHours ?? 0).toFixed(0)}h allocated
                    </span>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  rec,
  onHandled,
  router,
  compact,
}: {
  rec: RecommendationRow;
  onHandled: (id: string) => void;
  router: ReturnType<typeof useRouter>;
  compact?: boolean;
}) {
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState("");
  const [busy, setBusy] = useState(false);
  const urgency = urgencyOf(rec);

  async function dismiss() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("recommendations")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString(), fingerprint_at_action: null, severity_at_action: rec.severity })
      .eq("id", rec.id);
    setBusy(false);
    if (!error) {
      await logActivity(supabase, {
        entityTable: "recommendations",
        entityId: rec.id,
        eventType: "recommendation_dismissed",
        summary: `Dismissed: ${rec.title}`,
        recommendationId: rec.id,
      });
      onHandled(rec.id);
    }
  }

  async function snooze() {
    if (!snoozeDate) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("recommendations")
      .update({ status: "snoozed", snoozed_until: snoozeDate, fingerprint_at_action: null, severity_at_action: rec.severity })
      .eq("id", rec.id);
    setBusy(false);
    if (!error) {
      await logActivity(supabase, {
        entityTable: "recommendations",
        entityId: rec.id,
        eventType: "recommendation_snoozed",
        summary: `Snoozed until ${snoozeDate}: ${rec.title}`,
        recommendationId: rec.id,
      });
      onHandled(rec.id);
    }
  }

  async function markHandled(actionTaken: string) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("recommendations")
      .update({
        status: "handled",
        handled_at: new Date().toISOString(),
        action_taken: actionTaken,
        fingerprint_at_action: null,
        severity_at_action: rec.severity,
      })
      .eq("id", rec.id);
    setBusy(false);
    if (!error) {
      await logActivity(supabase, {
        entityTable: "recommendations",
        entityId: rec.id,
        eventType: "recommendation_handled",
        summary: `Marked handled (${actionTaken}): ${rec.title}`,
        recommendationId: rec.id,
      });
      onHandled(rec.id);
    }
  }

  // Canonical-record actions — the underlying business row updates, not just the recommendation.
  async function markLeadContacted() {
    setBusy(true);
    const supabase = createClient();
    const today = toIsoDate(new Date());
    const { error } = await supabase.from("leads").update({ last_contacted_date: today }).eq("id", rec.sourceId);
    if (error) {
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      entityTable: "leads",
      entityId: rec.sourceId,
      eventType: "lead_contacted",
      summary: "Marked contacted from Today",
      newValue: { last_contacted_date: today },
      recommendationId: rec.id,
    });
    await markHandled("marked_contacted");
    router.refresh();
  }

  async function markMilestonePaid() {
    setBusy(true);
    const supabase = createClient();
    const today = toIsoDate(new Date());
    const outstanding = typeof rec.context.outstanding === "number" ? rec.context.outstanding : rec.metricValue ?? 0;
    const { data: milestone } = await supabase.from("milestones").select("amount_due, amount_paid").eq("id", rec.sourceId).maybeSingle();
    if (!milestone) {
      setBusy(false);
      return;
    }
    const newAmountPaid = (milestone.amount_paid ?? 0) + outstanding;
    const { error } = await supabase
      .from("milestones")
      .update({ paid_date: today, amount_paid: newAmountPaid, status: "Paid" })
      .eq("id", rec.sourceId);
    if (error) {
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      entityTable: "milestones",
      entityId: rec.sourceId,
      eventType: "milestone_paid",
      summary: "Marked paid from Today",
      priorValue: { amount_paid: milestone.amount_paid },
      newValue: { amount_paid: newAmountPaid, status: "Paid" },
      recommendationId: rec.id,
    });
    await markHandled("marked_paid");
    router.refresh();
  }

  async function markContractorHoursPaid() {
    setBusy(true);
    const supabase = createClient();
    const today = toIsoDate(new Date());
    const entryIds = Array.isArray(rec.context.entryIds) ? (rec.context.entryIds as string[]) : [];
    if (entryIds.length === 0) {
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("subcontractor_time_entries").update({ paid_at: today }).in("id", entryIds);
    if (error) {
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      entityTable: "subcontractor_time_entries",
      entityId: entryIds[0],
      eventType: "contractor_hours_paid",
      summary: `Marked ${entryIds.length} time entr${entryIds.length === 1 ? "y" : "ies"} paid from Today`,
      newValue: { paid_at: today, entry_ids: entryIds },
      recommendationId: rec.id,
    });
    await markHandled("marked_paid");
    router.refresh();
  }

  async function suggestDecline() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("sow_sent").update({ status: "Declined" }).eq("id", rec.sourceId);
    if (error) {
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      entityTable: "sow_sent",
      entityId: rec.sourceId,
      eventType: "sow_declined",
      summary: "Closed out as Declined from Today (no response, unlikely to convert)",
      newValue: { status: "Declined" },
      recommendationId: rec.id,
    });
    await markHandled("declined");
    router.refresh();
  }

  const isMilestone = rec.type === "milestone_overdue" || rec.type === "milestone_due_this_week" || rec.type === "milestone_due_this_month";
  const closeoutSuggested = rec.type === "aging_sow" && rec.context.closeoutSuggested === true;

  return (
    <div className={`border border-line border-l-4 bg-surface p-3 ${URGENCY_STYLE[urgency].border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-wide ${URGENCY_STYLE[urgency].text}`}>
              {URGENCY_LABEL[urgency]}
            </span>
            <span className={compact ? "text-sm" : "text-[15px]"}>{rec.title}</span>
          </div>
          <p className="mt-1 text-xs text-ink/70">{rec.reason}</p>
        </div>
      </div>

      {snoozing ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={snoozeDate}
            onChange={(e) => setSnoozeDate(e.target.value)}
            className="border border-line px-2 py-1 text-xs"
          />
          <button onClick={snooze} disabled={busy || !snoozeDate} className="bg-brand-primary px-2 py-1 font-mono text-[10px] uppercase text-white disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setSnoozing(false)} className="font-mono text-[10px] uppercase text-ink/50 underline underline-offset-2">
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link href={openHref(rec)} className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2">
            Open
          </Link>
          {rec.type === "stale_lead" && (
            <button onClick={markLeadContacted} disabled={busy} className="font-mono text-[10px] uppercase text-positive underline underline-offset-2 disabled:opacity-50">
              Mark Contacted
            </button>
          )}
          {isMilestone && (
            <button onClick={markMilestonePaid} disabled={busy} className="font-mono text-[10px] uppercase text-positive underline underline-offset-2 disabled:opacity-50">
              Mark Paid
            </button>
          )}
          {rec.type === "contractor_hours_pending" && (
            <button onClick={markContractorHoursPaid} disabled={busy} className="font-mono text-[10px] uppercase text-positive underline underline-offset-2 disabled:opacity-50">
              Mark Paid
            </button>
          )}
          {closeoutSuggested && (
            <button onClick={suggestDecline} disabled={busy} className="font-mono text-[10px] uppercase text-warning underline underline-offset-2 disabled:opacity-50">
              Close Out (Decline)
            </button>
          )}
          <button onClick={() => markHandled("acknowledged")} disabled={busy} className="font-mono text-[10px] uppercase text-ink/60 underline underline-offset-2 disabled:opacity-50">
            Mark Handled
          </button>
          <button onClick={() => setSnoozing(true)} disabled={busy} className="font-mono text-[10px] uppercase text-ink/60 underline underline-offset-2 disabled:opacity-50">
            Snooze
          </button>
          <button onClick={dismiss} disabled={busy} className="font-mono text-[10px] uppercase text-ink/40 underline underline-offset-2 disabled:opacity-50">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

const PIPELINE_TYPES = new Set(["stale_lead", "aging_sow"]);
// Deliberately excludes milestone_due_this_month — those belong to the
// Month view, not Week. Mixing them in here read as "This Week" cards
// labeled "This Month," which is what prompted this split.
const WEEK_RISK_TYPES = new Set(["milestone_overdue", "milestone_due_this_week"]);
const OPS_TYPES = new Set(["contractor_hours_pending"]);

/** Read-only view of a company-level Signal (never persisted, so no dismiss/snooze/handle — see getWeeklyExtras). */
function ObservationCard({ signal }: { signal: Signal }) {
  const urgency = urgencyOf(signal);
  return (
    <div className={`border border-line border-l-4 bg-surface p-3 ${URGENCY_STYLE[urgency].border}`}>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-[10px] uppercase tracking-wide ${URGENCY_STYLE[urgency].text}`}>
          {URGENCY_LABEL[urgency]}
        </span>
        <span className="text-[15px]">{signal.title}</span>
      </div>
      <p className="mt-1 text-xs text-ink/70">{signal.reason}</p>
      <Link href={openHref(signal)} className="mt-2 inline-block font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2">
        Open
      </Link>
    </div>
  );
}

function WeekView({
  recommendations,
  weeklyExtras,
  onHandled,
  router,
}: {
  recommendations: RecommendationRow[];
  weeklyExtras: Signal[];
  onHandled: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const pipeline = recommendations.filter((r) => PIPELINE_TYPES.has(r.type));
  const risk = recommendations.filter((r) => WEEK_RISK_TYPES.has(r.type));
  const ops = recommendations.filter((r) => OPS_TYPES.has(r.type));
  const total = pipeline.length + risk.length + ops.length + weeklyExtras.length;

  return (
    <div>
      <h3 className="mb-1 font-mono text-xs uppercase tracking-wide text-ink/60">Top Moves This Week</h3>
      <p className="mb-6 text-xs text-ink/50">
        {total} item{total === 1 ? "" : "s"} across revenue, pipeline, and project risk — everything currently open, not
        just the daily top 5.
      </p>

      {weeklyExtras.length > 0 && (
        <section className="mb-8">
          <h4 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Revenue &amp; Forecast</h4>
          <div className="space-y-2">
            {weeklyExtras.map((s) => (
              <ObservationCard key={s.sourceId + s.type} signal={s} />
            ))}
          </div>
        </section>
      )}

      <WeekSection title="Sales Pipeline" items={pipeline} onHandled={onHandled} router={router} />
      <WeekSection title="Project Risk" items={risk} onHandled={onHandled} router={router} />
      <WeekSection title="Operations" items={ops} onHandled={onHandled} router={router} />

      {total === 0 && (
        <div className="border border-line bg-surface p-4 text-sm text-ink/50">Nothing open this week.</div>
      )}
    </div>
  );
}

function WeekSection({
  title,
  items,
  onHandled,
  router,
}: {
  title: string;
  items: RecommendationRow[];
  onHandled: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h4 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">
        {title} ({items.length})
      </h4>
      <div className="space-y-2">
        {items.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} onHandled={onHandled} router={router} compact />
        ))}
      </div>
    </section>
  );
}

function MonthView({
  recommendations,
  weeklyExtras,
  stats,
  onHandled,
  router,
}: {
  recommendations: RecommendationRow[];
  weeklyExtras: Signal[];
  stats: MonthStats;
  onHandled: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const bySeverity = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of recommendations) counts[r.severity] += 1;
    return counts;
  }, [recommendations]);

  const closeoutEligible = recommendations.filter((r) => r.type === "aging_sow" && r.context.closeoutSuggested === true).length;
  const forecastConcentration = weeklyExtras.find((s) => s.type === "forecast_concentration");
  const dueThisMonth = recommendations.filter((r) => r.type === "milestone_due_this_month");

  return (
    <div>
      <h3 className="mb-1 font-mono text-xs uppercase tracking-wide text-ink/60">Monthly Review</h3>
      <p className="mb-6 text-xs text-ink/50">Is the business getting healthier, and where should direction change?</p>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MonthStat
          label="Revenue vs. Last Year"
          value={stats.yoyDeltaPct !== null ? `${stats.yoyDeltaPct >= 0 ? "+" : ""}${stats.yoyDeltaPct.toFixed(0)}%` : "—"}
          accent={stats.yoyDeltaPct !== null && stats.yoyDeltaPct >= 0 ? "positive" : "warning"}
        />
        <MonthStat
          label="Top Referral Concentration"
          value={stats.topReferralSharePct !== null ? `${stats.topReferralSharePct}%` : "—"}
          sub={stats.topReferralName ?? undefined}
        />
        <MonthStat label="Open Priorities" value={String(recommendations.length)} sub={`${bySeverity.critical} critical`} />
        <MonthStat label="Quotes Ready to Close Out" value={String(closeoutEligible)} sub="120+ days, no response" />
      </div>

      {dueThisMonth.length > 0 && (
        <section className="mb-8">
          <h4 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">
            Due Later This Month ({dueThisMonth.length})
          </h4>
          <div className="space-y-2">
            {dueThisMonth.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} onHandled={onHandled} router={router} compact />
            ))}
          </div>
        </section>
      )}

      {forecastConcentration && (
        <section className="mb-8">
          <h4 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Forecast Concentration</h4>
          <ObservationCard signal={forecastConcentration} />
        </section>
      )}

      <p className="text-xs text-ink/40">
        Trend-over-time analysis (forecast accuracy, referral concentration history, quote win rate) needs more than
        one month of `activity_events`/`recommendations` history to be meaningful — these numbers will get richer as
        that accumulates.
      </p>
    </div>
  );
}

function MonthStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "positive" | "warning" }) {
  const valueClass = accent === "positive" ? "text-positive" : accent === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="border border-line border-t-2 border-t-brand-accent bg-surface p-4">
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{label}</div>
      <div className={`font-mono text-lg tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink/50">{sub}</div>}
    </div>
  );
}
