import { NextResponse } from "next/server";
import { getMyRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { currentBackupCycleDate } from "@/lib/backup/cycle";

const REPO = "moliveti/BelowTheTrusses";
const WORKFLOW_FILE = "weekly-backup.yml";

export const dynamic = "force-dynamic";

// "Backup Now" — creates the metadata row under normal RLS (so `is_owner()`
// governs it same as everything else), then asks GitHub Actions to actually
// run the job. See scripts/generate-backup.ts and
// .github/workflows/weekly-backup.yml for what happens after this returns.
export async function POST() {
  const role = await getMyRole();
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Backup triggering isn't configured yet — GITHUB_ACTIONS_TOKEN is missing." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Prevent accidental concurrent jobs.
  const { data: active, error: activeError } = await supabase
    .from("system_backups")
    .select("id")
    .in("status", ["pending", "generating"])
    .limit(1);
  if (activeError) {
    return NextResponse.json({ error: activeError.message }, { status: 500 });
  }
  if (active && active.length > 0) {
    return NextResponse.json({ error: "A backup is already generating." }, { status: 409 });
  }

  const now = new Date();
  const { data: row, error: insertError } = await supabase
    .from("system_backups")
    .insert({
      backup_cycle_date: currentBackupCycleDate(now),
      backup_type: "manual",
      requested_at: now.toISOString(),
      requested_by: user?.id ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const dispatchRes = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { backup_id: row.id, backup_type: "manual" } }),
    }
  );

  if (!dispatchRes.ok) {
    await supabase
      .from("system_backups")
      .update({ status: "failed", error_summary: `Failed to trigger the GitHub Actions workflow (HTTP ${dispatchRes.status}).` })
      .eq("id", row.id);
    return NextResponse.json({ error: `Failed to trigger backup workflow (${dispatchRes.status}).` }, { status: 502 });
  }

  await supabase.from("activity_events").insert({
    entity_table: "system_backups",
    entity_id: row.id,
    event_type: "backup_manual_requested",
    summary: "Manual backup requested from Backups & Recovery",
    source: "ui",
  });

  return NextResponse.json({ id: row.id });
}
