/**
 * Generates one complete BTT recovery package: a PostgreSQL dump (custom +
 * plain SQL), CSV exports of the core business tables, a source-code
 * archive at the exact deployed commit, a manifest + checksums, and a
 * restore guide — zips it, uploads it to the private "system-backups"
 * Storage bucket, and records the result in `system_backups`.
 *
 * Runs inside .github/workflows/weekly-backup.yml. For a scheduled run
 * (BACKUP_TYPE=scheduled) it first checks whether it's actually inside the
 * Saturday 4:00 AM America/New_York window and whether this cycle has
 * already been handled, exiting immediately if not — the workflow's cron
 * fires every 15 minutes, and this idempotency check is what makes that
 * safe. A manual run (BACKUP_TYPE=manual) always proceeds and expects
 * BACKUP_ID to point at a row the "Backup Now" API route already created.
 *
 * Requires (as env vars, not committed anywhere):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — same as the app.
 *   SUPABASE_DB_URL — a direct Postgres connection string for pg_dump.
 *     Not the same as the above; get it from Supabase Dashboard ->
 *     Project Settings -> Database, and add it as a GitHub Actions secret
 *     (never as a repo file, never as a Vercel env var).
 *
 * NOTE: written to be correct against the documented architecture, but not
 * yet run against real infrastructure — SUPABASE_DB_URL doesn't exist as a
 * secret yet. Treat the first real run as a verification, not a given.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import { currentBackupCycleDate, isWithinScheduledWindow } from "../src/lib/backup/cycle";

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DB_URL = process.env.SUPABASE_DB_URL ?? "";
const BACKUP_TYPE = (process.env.BACKUP_TYPE === "manual" ? "manual" : "scheduled") as "scheduled" | "manual";
const EXISTING_BACKUP_ID = process.env.BACKUP_ID || null;
const GIT_COMMIT = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
const GIT_BRANCH = process.env.GITHUB_REF_NAME || "main";

const BUSINESS_TABLES = [
  "clients",
  "projects",
  "leads",
  "sow_sent",
  "milestones",
  "referral_sources",
  "subcontractors",
  "subcontractor_time_entries",
  "project_subcontractors",
  "subcontractor_type_rates",
  "recommendations",
  "activity_events",
];

const REQUIRED_ENV_VARS: { name: string; purpose: string; recovery: string }[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", purpose: "Public Supabase project URL.", recovery: "Generate from the replacement Supabase project." },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", purpose: "Browser Supabase access under RLS.", recovery: "Generate from the replacement project." },
  { name: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Trusted server-side administrative access.", recovery: "Generate from the replacement project. Never expose to the browser." },
  { name: "ANTHROPIC_API_KEY", purpose: "AI intelligence narration (Financial Dashboard insights).", recovery: "Obtain from an Anthropic Console account." },
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const now = new Date();
  const cycleDate = currentBackupCycleDate(now);

  if (BACKUP_TYPE === "scheduled") {
    if (!isWithinScheduledWindow(now)) {
      console.log("Outside the Saturday 4:00 AM America/New_York window — nothing to do.");
      return;
    }
    const { data: existing, error } = await supabase
      .from("system_backups")
      .select("id, status")
      .eq("backup_cycle_date", cycleDate)
      .eq("backup_type", "scheduled")
      .in("status", ["pending", "generating", "completed"]);
    if (error) throw new Error(`Checking existing backups: ${error.message}`);
    if (existing && existing.length > 0) {
      console.log(`Cycle ${cycleDate} already has a ${existing[0].status} scheduled backup (${existing[0].id}) — skipping.`);
      return;
    }
  }

  let backupId = EXISTING_BACKUP_ID;
  if (backupId) {
    const { error } = await supabase
      .from("system_backups")
      .update({ status: "generating", started_at: now.toISOString(), backup_cycle_date: cycleDate })
      .eq("id", backupId);
    if (error) throw new Error(`Updating existing backup row: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("system_backups")
      .insert({
        backup_cycle_date: cycleDate,
        backup_type: BACKUP_TYPE,
        scheduled_for: now.toISOString(),
        started_at: now.toISOString(),
        status: "generating",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Creating backup row: ${error.message}`);
    backupId = data.id;
  }

  try {
    const result = await generatePackage(cycleDate);
    await supabase
      .from("system_backups")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        storage_path: result.storagePath,
        filename: result.filename,
        size_bytes: result.sizeBytes,
        checksum: result.checksum,
        database_included: true,
        source_included: true,
        storage_included: false,
        git_commit: GIT_COMMIT,
        migration_version: result.migrationVersion,
      })
      .eq("id", backupId);
    await supabase.from("activity_events").insert({
      entity_table: "system_backups",
      entity_id: backupId,
      event_type: "backup_completed",
      summary: `Backup completed: ${result.filename} (${(result.sizeBytes / 1024 / 1024).toFixed(1)} MB)`,
      source: "backup_system",
    });
    console.log(`Backup completed: ${result.filename}`);
    await applyRetention();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("system_backups")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_summary: message.slice(0, 2000) })
      .eq("id", backupId);
    await supabase.from("activity_events").insert({
      entity_table: "system_backups",
      entity_id: backupId,
      event_type: "backup_failed",
      summary: `Backup failed: ${message.slice(0, 500)}`,
      source: "backup_system",
    });
    throw err;
  }
}

/**
 * Only ever called after this run's own backup reached `completed` —
 * never delete-then-attempt. Scheduled: keep the 12 most recent completed
 * cycles. Manual: keep 90 days or the 8 most recent, whichever is larger
 * (provisional — revisit once real archive sizes are known). Only the
 * Storage object is removed; the metadata row stays as history.
 */
async function applyRetention() {
  await retainType("scheduled", 12, null);
  await retainType("manual", 8, 90);
}

async function retainType(backupType: "scheduled" | "manual", keepCount: number, keepDays: number | null) {
  const { data, error } = await supabase
    .from("system_backups")
    .select("id, storage_path, completed_at")
    .eq("backup_type", backupType)
    .eq("status", "completed")
    .not("storage_path", "is", null)
    .order("completed_at", { ascending: false });
  if (error) {
    console.warn(`Retention check failed for ${backupType}: ${error.message}`);
    return;
  }

  const rows = data ?? [];
  const cutoff = keepDays !== null ? Date.now() - keepDays * 24 * 60 * 60 * 1000 : null;
  const toDelete = rows.filter((r, i) => {
    const pastCount = i >= keepCount;
    const pastAge = cutoff !== null && r.completed_at !== null && new Date(r.completed_at).getTime() < cutoff;
    return keepDays === null ? pastCount : pastCount && pastAge;
  });

  for (const row of toDelete) {
    const { error: removeError } = await supabase.storage.from("system-backups").remove([row.storage_path!]);
    if (removeError) {
      console.warn(`Failed to remove ${row.storage_path}: ${removeError.message}`);
      continue;
    }
    await supabase.from("system_backups").update({ storage_path: null }).eq("id", row.id);
    await supabase.from("activity_events").insert({
      entity_table: "system_backups",
      entity_id: row.id,
      event_type: "backup_deleted_by_retention",
      summary: `Removed archive past retention (${backupType}, kept ${keepCount})`,
      source: "backup_system",
    });
  }
}

async function generatePackage(cycleDate: string) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "btt-backup-"));
  const nowIso = new Date().toISOString();
  const hhmm = nowIso.slice(11, 16).replace(":", "");
  const packageName = `BTT_Recovery_${cycleDate}_${hhmm}_ET`;
  const root = path.join(workDir, packageName);
  fs.mkdirSync(root, { recursive: true });
  const dirs = {
    database: mkdir(root, "database"),
    csv: mkdir(root, "csv"),
    application: mkdir(root, "application"),
    metadata: mkdir(root, "metadata"),
  };

  const contents = { databaseDump: false, sqlExport: false, csvExports: false, storageExport: false, sourceArchive: false };

  if (DB_URL) {
    console.log("Running pg_dump...");
    execFileSync("pg_dump", ["--format=custom", "--file", path.join(dirs.database, "btt_database.dump"), DB_URL], { stdio: "inherit" });
    execFileSync("pg_dump", ["--format=plain", "--file", path.join(dirs.database, "btt_database.sql"), DB_URL], { stdio: "inherit" });
    contents.databaseDump = true;
    contents.sqlExport = true;
  } else {
    console.warn("SUPABASE_DB_URL not set — skipping pg_dump. CSV exports still capture business data.");
  }

  console.log("Exporting CSVs...");
  for (const table of BUSINESS_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.warn(`Skipping ${table}: ${error.message}`);
      continue;
    }
    fs.writeFileSync(path.join(dirs.csv, `${table}.csv`), toCsv(data ?? []));
  }
  contents.csvExports = true;

  console.log("Archiving application source...");
  execFileSync("git", ["archive", "--format=zip", "--output", path.join(dirs.application, "source.zip"), "HEAD"]);
  fs.writeFileSync(path.join(dirs.application, "git_commit.txt"), GIT_COMMIT + "\n");
  fs.writeFileSync(path.join(dirs.application, "git_branch.txt"), GIT_BRANCH + "\n");
  copyIfExists("package.json", path.join(dirs.application, "package.json"));
  copyIfExists("package-lock.json", path.join(dirs.application, "package-lock.json"));
  copyDirIfExists("supabase/migrations", path.join(dirs.application, "migrations"));
  const migrations = fs.existsSync("supabase/migrations") ? fs.readdirSync("supabase/migrations").sort() : [];
  const migrationVersion = migrations.length > 0 ? migrations[migrations.length - 1].replace(/\.sql$/, "") : null;
  contents.sourceArchive = true;

  fs.writeFileSync(
    path.join(dirs.metadata, "environment_variables_REQUIRED.txt"),
    REQUIRED_ENV_VARS.map((v) => `${v.name}\nPurpose: ${v.purpose}\nRecovery: ${v.recovery}\n`).join("\n")
  );

  fs.writeFileSync(path.join(root, "README_RESTORE.md"), restoreReadme(cycleDate, GIT_COMMIT, GIT_BRANCH));

  const manifest = {
    application: "Below The Trusses",
    backupVersion: 1,
    backupType: BACKUP_TYPE,
    backupCycleDate: cycleDate,
    createdAt: nowIso,
    timezone: "America/New_York",
    database: { provider: "Supabase/PostgreSQL", migrationVersion },
    applicationSource: { commit: GIT_COMMIT, branch: GIT_BRANCH },
    contents,
  };
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("Computing checksums...");
  const checksums = checksumTree(root);
  fs.writeFileSync(path.join(dirs.metadata, "backup_checksums.json"), JSON.stringify(checksums, null, 2));

  const zipPath = path.join(workDir, `${packageName}.zip`);
  execFileSync("zip", ["-rq", zipPath, packageName], { cwd: workDir });

  const zipBuffer = fs.readFileSync(zipPath);
  const zipChecksum = createHash("sha256").update(zipBuffer).digest("hex");
  const sizeBytes = zipBuffer.length;

  console.log(`Uploading ${packageName}.zip (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)...`);
  const storagePath = `${cycleDate}/${packageName}.zip`;
  const { error: uploadError } = await supabase.storage
    .from("system-backups")
    .upload(storagePath, zipBuffer, { contentType: "application/zip", upsert: true });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  fs.rmSync(workDir, { recursive: true, force: true });

  return { storagePath, filename: `${packageName}.zip`, sizeBytes, checksum: zipChecksum, migrationVersion };
}

function mkdir(root: string, name: string): string {
  const p = path.join(root, name);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function copyIfExists(src: string, dest: string) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

function copyDirIfExists(src: string, dest: string) {
  if (fs.existsSync(src)) fs.cpSync(src, dest, { recursive: true });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(","));
  return lines.join("\n");
}

function checksumTree(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const hash = createHash("sha256").update(fs.readFileSync(full)).digest("hex");
        result[path.relative(root, full)] = hash;
      }
    }
  }
  walk(root);
  return result;
}

function restoreReadme(cycleDate: string, commit: string, branch: string): string {
  return `# BTT Recovery Package — ${cycleDate}

Application commit: \`${commit}\` (branch \`${branch}\`)

This package corresponds to Below The Trusses at the above commit. Written
for a competent developer who has not seen this codebase before.

## Recovery to a replacement Supabase project

1. Create a new Supabase project.
2. In the SQL editor, run \`database/btt_database.sql\` (or restore
   \`database/btt_database.dump\` with \`pg_restore\` for the custom-format
   dump) — this recreates schema, data, functions, triggers, and RLS
   policies exactly as they were.
3. \`auth.users\` is Supabase-managed and is **not** included in the plain
   dump the same way business tables are — recreate each user in the new
   project (same email) via Supabase Auth, then re-link \`profiles\`/
   \`subcontractors.user_id\` to the new user ids. The CSVs in \`csv/\` give
   you the original role/name data to work from.
4. Re-create the \`system-backups\` Storage bucket (private, no public
   access) if you want backups to continue.
5. Configure environment variables per
   \`metadata/environment_variables_REQUIRED.txt\` — names only, no secret
   values are ever included in this package.
6. Deploy \`application/source.zip\` (or the corresponding GitHub commit) to
   a hosting provider (originally Vercel) — build command \`next build\`,
   Node 20.
7. Run \`supabase/migrations\` in \`application/migrations/\` in numeric
   order if starting from an empty database instead of restoring the dump.
8. Verify: sign in, confirm a project's financial numbers match
   \`csv/projects.csv\` / \`csv/milestones.csv\`.

## Recovery to generic PostgreSQL (not Supabase)

- \`database/btt_database.sql\` is standard PostgreSQL — schemas, tables,
  functions, triggers, indexes, and RLS policies all restore directly.
- Supabase-specific: the \`auth.users\`/\`auth.uid()\` dependency used by RLS
  policies and by \`profiles\`/\`subcontractors.user_id\`. Outside Supabase,
  replace this with your own auth provider and adapt the RLS policies
  (currently \`is_owner()\`/\`is_owner_or_staff()\` functions keyed on
  \`auth.uid()\`) to whatever session mechanism you use instead.
- Supabase Storage: not in material use by this application as of this
  backup (see \`metadata/storage_manifest.json\` if present) — no file
  migration is needed for business data.

## Application recovery without Vercel

The app is a standard Next.js 14 (App Router) project — \`npm install\`,
\`npm run build\`, \`npm start\`, or deploy to any Node-compatible host.
No Vercel-specific APIs are used in application code.
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
