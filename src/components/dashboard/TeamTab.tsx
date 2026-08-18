"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamMember } from "@/lib/admin/types";
import type { Role } from "@/lib/profile";
import type { BackupRow, CurrentCycleStatus } from "@/lib/backup/queries";
import type { MarketIntelRun } from "@/lib/government/types";
import { BackupsSection } from "./BackupsSection";

const ROLES: Role[] = ["owner", "staff", "subcontractor"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// A stale/expired session gets bounced by middleware to /login before it
// ever reaches the API route, which fetch() follows silently — surface
// that distinctly instead of a confusing generic failure.
async function errorFromResponse(res: Response): Promise<string> {
  if (res.redirected && res.url.includes("/login")) {
    return "Your session expired — refresh the page and sign in again.";
  }
  const body = await res.json().catch(() => ({}));
  return body.error ?? "Something went wrong.";
}

export function TeamTab({
  team,
  backupHistory,
  currentBackupCycle,
  marketIntelRun,
}: {
  team: TeamMember[];
  backupHistory: BackupRow[];
  currentBackupCycle: CurrentCycleStatus;
  marketIntelRun: MarketIntelRun | null;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Admin</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Owner Access Only</span>
      </div>

      <section className="mb-10">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">New User</h3>
        <NewUserForm />
      </section>

      <section>
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Existing Users</h3>
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[680px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name / Email</th>
                <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Role</th>
                <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Created</th>
                <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Last Sign-In</th>
                <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Reset Password</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <UserRow key={member.id} member={member} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BackupsSection currentCycle={currentBackupCycle} history={backupHistory} />

      <MarketIntelCostSection run={marketIntelRun} />
    </div>
  );
}

// Cost transparency for the weekly Market Intelligence Update — so search/AI
// usage never quietly runs up a bill without the owner seeing it.
function MarketIntelCostSection({ run }: { run: MarketIntelRun | null }) {
  return (
    <section className="mt-10">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Market Intelligence — Usage &amp; Cost</h3>
      {!run ? (
        <div className="border border-line bg-surface p-4 text-sm text-ink/50">No weekly run yet.</div>
      ) : (
        <div className="border border-line bg-surface p-4 text-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-ink/50">
              Week of {fmtDate(run.weekOf)}
            </span>
            <span
              className={`font-mono text-[10px] uppercase tracking-wide ${
                run.status === "completed" ? "text-positive" : run.status === "failed" ? "text-warning" : "text-ink/50"
              }`}
            >
              {run.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Search Requests</div>
              <div className="font-mono text-lg tabular-nums">{run.searchRequests}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink/40">AI Summarization Calls</div>
              <div className="font-mono text-lg tabular-nums">{run.aiSummaryCalls}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Estimated Cost</div>
              <div className="font-mono text-lg tabular-nums">${run.estimatedCostUsd.toFixed(2)}</div>
            </div>
          </div>
          {run.errorSummary && <p className="mt-2 text-xs text-warning">{run.errorSummary}</p>}
        </div>
      )}
    </section>
  );
}

function UserRow({ member }: { member: TeamMember }) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [roleError, setRoleError] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function changeRole(newRole: Role) {
    setRoleError("");
    setSavingRole(true);
    const res = await fetch(`/api/admin/users/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setSavingRole(false);
    if (!res.ok) {
      setRoleError(await errorFromResponse(res));
      return;
    }
    setRole(newRole);
    router.refresh();
  }

  async function savePassword() {
    setPasswordError("");
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    const res = await fetch(`/api/admin/users/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordError(await errorFromResponse(res));
      return;
    }
    setPassword("");
    setResetting(false);
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 3000);
  }

  return (
    <tr className="border-b border-line align-top">
      <td className="px-3 py-2">
        <div>{member.fullName ?? member.email}</div>
        {member.fullName && <div className="text-xs text-ink/60">{member.email}</div>}
      </td>
      <td className="px-3 py-2">
        <select
          value={role}
          onChange={(e) => changeRole(e.target.value as Role)}
          disabled={savingRole}
          className="border border-line px-2 py-1 text-xs disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {roleError && <div className="mt-1 text-[10px] text-warning">{roleError}</div>}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-ink/60">{fmtDate(member.createdAt)}</td>
      <td className="px-3 py-2 font-mono text-xs text-ink/60">{fmtDate(member.lastSignInAt)}</td>
      <td className="px-3 py-2">
        {resetting ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-32 border border-line px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={savePassword}
              disabled={savingPassword}
              className="bg-brand-primary px-2 py-1 font-mono text-[10px] uppercase text-white disabled:opacity-50"
            >
              {savingPassword ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResetting(false);
                setPassword("");
                setPasswordError("");
              }}
              className="font-mono text-[10px] uppercase text-ink/50 underline underline-offset-2"
            >
              Cancel
            </button>
            {passwordError && <div className="w-full text-[10px] text-warning">{passwordError}</div>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setResetting(true)}
            className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2"
          >
            Reset Password
          </button>
        )}
        {passwordSaved && <div className="mt-1 text-[10px] text-positive">✓ Password updated</div>}
      </td>
    </tr>
  );
}

function NewUserForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSavedMessage(false);
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password, role }),
    });
    setSaving(false);

    if (!res.ok) {
      setError(await errorFromResponse(res));
      return;
    }

    setFullName("");
    setEmail("");
    setPassword("");
    setRole("staff");
    setSavedMessage(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedMessage(false), 3000);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 border border-line bg-surface p-4 sm:grid-cols-4">
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Email *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Password *</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 sm:col-span-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create user"}
        </button>
        {error && <span className="ml-3 text-xs text-warning">{error}</span>}
        {savedMessage && <span className="ml-3 text-xs text-positive">✓ User created</span>}
      </div>
    </form>
  );
}
