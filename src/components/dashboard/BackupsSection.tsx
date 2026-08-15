"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BackupRow, CurrentCycleStatus } from "@/lib/backup/queries";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "text-ink/50",
  generating: "text-brand-accent",
  completed: "text-positive",
  failed: "text-warning",
};

export function BackupsSection({ currentCycle, history }: { currentCycle: CurrentCycleStatus; history: BackupRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const hasActiveRun = currentCycle.hasActiveRun || history.some((h) => h.status === "pending" || h.status === "generating");

  // Poll while a job is running so QUEUED -> GENERATING -> READY/FAILED reflects without a manual refresh.
  useEffect(() => {
    if (!hasActiveRun) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(pollRef.current);
  }, [hasActiveRun, router]);

  async function createBackup() {
    setError("");
    setCreating(true);
    const res = await fetch("/api/backups", { method: "POST" });
    setCreating(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to start backup.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-10">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Backups &amp; Recovery</h3>

      <div className="mb-4 border border-line bg-surface p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink/40">This Week's Recovery</div>
        <div className="mb-3 text-xs text-ink/60">Cycle: Saturday {currentCycle.cycleDate} · 4:00 AM ET</div>

        {currentCycle.validBackup ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-mono text-[10px] uppercase text-positive">Successful</span>
            <span className="text-xs text-ink/70">Generated {fmtDateTime(currentCycle.validBackup.completedAt)}</span>
            <span className="text-xs text-ink/70">{fmtSize(currentCycle.validBackup.sizeBytes)}</span>
            {currentCycle.validBackup.gitCommit && (
              <span className="font-mono text-xs text-ink/50">commit {currentCycle.validBackup.gitCommit.slice(0, 7)}</span>
            )}
            <span className="text-xs text-ink/70">
              Local copy: {currentCycle.validBackup.downloadedAt ? `Downloaded ${fmtDateTime(currentCycle.validBackup.downloadedAt)}` : "Not yet downloaded"}
            </span>
            <a
              href={`/api/backups/${currentCycle.validBackup.id}/download`}
              className="bg-brand-primary px-3 py-1.5 font-mono text-[10px] uppercase text-white hover:bg-brand-primary/90"
            >
              Download Backup
            </a>
          </div>
        ) : hasActiveRun ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-brand-accent">Generating</span>
            <span className="text-xs text-ink/60">This week's recovery package is being created…</span>
          </div>
        ) : currentCycle.isOverdue || currentCycle.hasFailedAttempt ? (
          <div>
            <span className="font-mono text-[10px] uppercase text-warning">
              {currentCycle.hasFailedAttempt ? "Failed" : "Overdue"}
            </span>
            <p className="mt-1 text-xs text-ink/60">
              This week's Saturday recovery package hasn&rsquo;t completed successfully. A manual backup now will satisfy
              this week&rsquo;s requirement.
            </p>
          </div>
        ) : (
          <p className="text-xs text-ink/50">This week&rsquo;s scheduled backup hasn&rsquo;t run yet.</p>
        )}
      </div>

      <div className="mb-6">
        <button
          onClick={createBackup}
          disabled={creating || hasActiveRun}
          className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {hasActiveRun ? "Generating…" : creating ? "Starting…" : "Create Backup Now"}
        </button>
        {error && <span className="ml-3 text-xs text-warning">{error}</span>}
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Date</th>
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Type</th>
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cycle</th>
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Status</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Size</th>
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Commit</th>
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Downloaded</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-xs text-ink/50">
                  No backups yet.
                </td>
              </tr>
            ) : (
              history.map((b) => (
                <tr key={b.id} className="border-b border-line">
                  <td className="px-3 py-2 font-mono text-xs">{fmtDateTime(b.createdAt)}</td>
                  <td className="px-3 py-2 text-xs capitalize">{b.backupType}</td>
                  <td className="px-3 py-2 font-mono text-xs">{b.backupCycleDate}</td>
                  <td className={`px-3 py-2 font-mono text-[10px] uppercase ${STATUS_STYLE[b.status]}`}>{b.status}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmtSize(b.sizeBytes)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink/50">{b.gitCommit ? b.gitCommit.slice(0, 7) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-ink/60">{b.downloadedAt ? fmtDateTime(b.downloadedAt) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {b.status === "completed" && (
                      <a
                        href={`/api/backups/${b.id}/download`}
                        className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2"
                      >
                        Download
                      </a>
                    )}
                    {b.status === "failed" && b.errorSummary && (
                      <span className="text-[10px] text-warning" title={b.errorSummary}>
                        View Error
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
