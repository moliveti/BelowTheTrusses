import { createClient } from "@/lib/supabase/server";
import { currentBackupCycleDate, isPastCompletionWindow } from "./cycle";

export type BackupType = "scheduled" | "manual";
export type BackupStatus = "pending" | "generating" | "completed" | "failed";

export interface BackupRow {
  id: string;
  backupCycleDate: string;
  backupType: BackupType;
  status: BackupStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  filename: string | null;
  sizeBytes: number | null;
  gitCommit: string | null;
  errorSummary: string | null;
  downloadedAt: string | null;
  createdAt: string;
}

const SELECT_COLUMNS =
  "id, backup_cycle_date, backup_type, status, requested_at, started_at, completed_at, filename, size_bytes, git_commit, error_summary, downloaded_at, created_at";

function mapRow(r: {
  id: string;
  backup_cycle_date: string;
  backup_type: string;
  status: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  filename: string | null;
  size_bytes: number | null;
  git_commit: string | null;
  error_summary: string | null;
  downloaded_at: string | null;
  created_at: string;
}): BackupRow {
  return {
    id: r.id,
    backupCycleDate: r.backup_cycle_date,
    backupType: r.backup_type as BackupType,
    status: r.status as BackupStatus,
    requestedAt: r.requested_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    filename: r.filename,
    sizeBytes: r.size_bytes,
    gitCommit: r.git_commit,
    errorSummary: r.error_summary,
    downloadedAt: r.downloaded_at,
    createdAt: r.created_at,
  };
}

export async function getBackupHistory(limit = 30): Promise<BackupRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_backups")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`system_backups: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export interface CurrentCycleStatus {
  cycleDate: string;
  /** The most recent completed row for this cycle — scheduled or manual, whichever is later, per the "a successful manual backup may satisfy the cycle" rule. */
  validBackup: BackupRow | null;
  hasActiveRun: boolean;
  hasFailedAttempt: boolean;
  /** No completed/active backup, and past the expected completion window. */
  isOverdue: boolean;
}

export async function getCurrentCycleStatus(now: Date = new Date()): Promise<CurrentCycleStatus> {
  const cycleDate = currentBackupCycleDate(now);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_backups")
    .select(SELECT_COLUMNS)
    .eq("backup_cycle_date", cycleDate)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`system_backups: ${error.message}`);

  const rows = (data ?? []).map(mapRow);
  const validBackup = rows.find((r) => r.status === "completed") ?? null;
  const hasActiveRun = rows.some((r) => r.status === "pending" || r.status === "generating");
  const hasFailedAttempt = rows.some((r) => r.status === "failed");
  const isOverdue = !validBackup && !hasActiveRun && isPastCompletionWindow(now, cycleDate);

  return { cycleDate, validBackup, hasActiveRun, hasFailedAttempt, isOverdue };
}
