/**
 * Idempotent import: reference/2025_BTT_Forecast.xlsx → Supabase schema.
 *
 * Run with: npm run import:excel
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 * (this script bypasses RLS via the service role key — never run it client-side).
 *
 * Source sheets used (see docs/02_DATA_MODEL.md "Migration Mapping"):
 *   - INPUT: one row per client/engagement — Client, Type, Active, then one
 *     column per month (Jan-24 … Dec-26). Each non-empty month cell becomes
 *     one `milestones` row (paid_date = 1st of that month, status='Paid').
 *   - SOW Sent: proposals that didn't convert — DATE, NAME, FEE, NOTES.
 *
 * Judgment calls made here (documented since the source data has no columns
 * for these — see docs/02_DATA_MODEL.md §4.1 and the migration table):
 *   - contract_signed_date / contract_value / billing_method are left NULL
 *     on migrated rows. The old sheet only ever captured the "cash collected"
 *     timeline, never a signed-contract timeline — inventing a contract_value
 *     from the sum of historical payments would conflate the two, which is
 *     exactly the distinction this rebuild exists to fix (see PRD §4.1).
 *   - pipeline_stage defaults to 'Signed' for every migrated row, since each
 *     one represents money that was actually collected historically.
 *   - Referral parsing: "(Name)_Rest" or "Rest (Name)" → referral = Name,
 *     display name = Rest with the parenthetical stripped. This mirrors the
 *     existing spreadsheet naming convention described in PRD §4.6. It is a
 *     mechanical regex match — a few source rows use parentheses for
 *     non-referral notes (e.g. "Commission (Rugs,Shades,Tile, Cabinetry)");
 *     those get imported as literal (bogus) referral sources too. The script
 *     logs every parsed referral so the owner can delete/rename bad ones in
 *     the `referral_sources` table — safe to do post-import since projects
 *     link by referral_source_id, not by name.
 *
 * Idempotency: clients are upserted by unique `name`; projects by unique
 * (client_id, name); milestones by unique (project_id, due_date, name).
 * Re-running after fixing source rows updates in place — it does not
 * duplicate or wipe manually-entered detail (scope tags, subcontractors,
 * contract dates, etc.) added after a prior import, since this script never
 * touches those columns/tables.
 */

import dotenv from "dotenv";
import ExcelJS from "exceljs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const XLSX_PATH = path.resolve(__dirname, "../reference/2025_BTT_Forecast.xlsx");

const MONTH_COL_RE = /^([A-Za-z]{3})-(\d{2})$/;
const MONTH_NUM: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

const BILLING_METHOD_DEFAULT: Record<string, string> = {
  Residential: "Fixed Fee",
  Commercial: "Hourly",
  Furniture: "Commission",
};

function parseReferral(raw: string): { display: string; referral: string | null } {
  const trimmed = raw.trim();

  const prefixMatch = trimmed.match(/^\(([^)]+)\)_(.+)$/);
  if (prefixMatch) {
    return { display: cleanSpaces(prefixMatch[2]), referral: cleanSpaces(prefixMatch[1]) };
  }

  const suffixMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (suffixMatch) {
    return { display: cleanSpaces(suffixMatch[1]), referral: cleanSpaces(suffixMatch[2]) };
  }

  return { display: cleanSpaces(trimmed), referral: null };
}

function cleanSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

// SOW Sent "DATE" column is entered as free-text "MM.DD.YY" (e.g. "03.18.25"),
// not a real Excel date, and a few rows use "—" for unknown/no date.
function parseSowDate(raw: string | number | Date | null): string | null {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function cellValue(cell: ExcelJS.Cell): string | number | Date | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && "result" in (v as any)) return (v as any).result ?? null;
  if (typeof v === "object" && "text" in (v as any)) return (v as any).text ?? null;
  return v as string | number;
}

async function upsertReferralSource(name: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("referral_sources")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("referral_sources")
    .insert({ name, type: "Other" })
    .select("id")
    .single();
  if (error) {
    console.warn(`  ! could not create referral_source "${name}": ${error.message}`);
    return null;
  }
  console.log(`  + new referral_source "${name}" (type defaulted to 'Other' — reclassify in-app)`);
  return created.id;
}

async function upsertClient(name: string): Promise<string> {
  const { data, error } = await supabase
    .from("clients")
    .upsert({ name }, { onConflict: "name", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error) throw new Error(`upsert client "${name}": ${error.message}`);
  return data.id;
}

async function upsertProject(input: {
  client_id: string;
  name: string;
  type: string;
  active: boolean;
  referral_source_id: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("projects")
    .upsert(
      {
        client_id: input.client_id,
        name: input.name,
        type: input.type,
        active: input.active,
        referral_source_id: input.referral_source_id,
        billing_method: BILLING_METHOD_DEFAULT[input.type] ?? null,
        pipeline_stage: "Signed",
      },
      { onConflict: "client_id,name" }
    )
    .select("id")
    .single();
  if (error) throw new Error(`upsert project "${input.name}": ${error.message}`);
  return data.id;
}

async function upsertMonthlyMilestone(input: {
  project_id: string;
  monthLabel: string; // e.g. "Jan-24"
  amount: number;
}) {
  const m = input.monthLabel.match(MONTH_COL_RE);
  if (!m) return;
  const monthNum = MONTH_NUM[m[1]];
  const year = 2000 + Number(m[2]);
  const dueDate = `${year}-${String(monthNum).padStart(2, "0")}-01`;
  const name = `${m[1]} ${year} Payment`;

  // The source sheet only records a billed amount per month, not whether it
  // was actually collected — so only months already in the past are safe to
  // assume paid. Anything due today or later must stay Pending so it shows
  // up as forecast, not revenue, until someone confirms payment in the app.
  const todayIso = new Date().toISOString().slice(0, 10);
  const isPast = dueDate < todayIso;

  const { error } = await supabase.from("milestones").upsert(
    {
      project_id: input.project_id,
      name,
      sequence_order: monthNum + (year - 2024) * 12,
      due_date: dueDate,
      amount_due: input.amount,
      paid_date: isPast ? dueDate : null,
      amount_paid: isPast ? input.amount : null,
      status: isPast ? "Paid" : "Pending",
    },
    { onConflict: "project_id,due_date,name" }
  );
  if (error) throw new Error(`upsert milestone "${name}" for project ${input.project_id}: ${error.message}`);
}

async function importInputSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("INPUT");
  if (!sheet) throw new Error('Sheet "INPUT" not found in workbook');

  // Row 1 is blank spacer; the real header ("Client", "Type", "Active", month
  // columns) is row 2.
  const headerRow = sheet.getRow(2);
  const firstDataRow = 3;
  const columns: { index: number; label: string }[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const label = cellValue(cell);
    if (typeof label === "string" && label.trim()) {
      columns.push({ index: colNumber, label: label.trim() });
    }
  });

  const clientCol = columns.find((c) => c.label === "Client");
  const typeCol = columns.find((c) => c.label === "Type");
  const activeCol = columns.find((c) => c.label === "Active");
  const monthCols = columns.filter((c) => MONTH_COL_RE.test(c.label));

  if (!clientCol || !typeCol || !activeCol) {
    throw new Error("INPUT sheet missing expected Client/Type/Active columns");
  }

  type ParsedRow = {
    display: string;
    type: string;
    active: boolean;
    referral: string | null;
    monthCells: { label: string; amount: number }[];
  };

  const parsedRows: ParsedRow[] = [];
  for (let r = firstDataRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rawClient = cellValue(row.getCell(clientCol.index));
    if (!rawClient || typeof rawClient !== "string") continue;

    const type = cellValue(row.getCell(typeCol.index));
    if (!type || typeof type !== "string") continue;

    const activeRaw = cellValue(row.getCell(activeCol.index));
    const active = activeRaw === "Yes";

    const { display, referral } = parseReferral(rawClient);

    const monthCells: { label: string; amount: number }[] = [];
    for (const col of monthCols) {
      const raw = cellValue(row.getCell(col.index));
      if (typeof raw === "number" && raw !== 0) monthCells.push({ label: col.label, amount: raw });
    }

    parsedRows.push({ display, type, active, referral, monthCells });
  }

  // A handful of clients (e.g. "COE_GA Capital Reno") have two genuinely
  // distinct engagements under the same display name but different `type`
  // (a Furniture commission stream and a separate Commercial fee stream).
  // If every occurrence of a display name shares the same type, dedupe with
  // a plain counter suffix (true duplicate rows, e.g. two identical "Terry,
  // Kit (Dantzler)" entries). If a display name spans more than one type,
  // always suffix with the type so the two engagements don't collide into
  // one project and silently overwrite each other's milestones.
  const typesByDisplay = new Map<string, Set<string>>();
  for (const row of parsedRows) {
    if (!typesByDisplay.has(row.display)) typesByDisplay.set(row.display, new Set());
    typesByDisplay.get(row.display)!.add(row.type);
  }

  const nameCounts = new Map<string, number>();
  let rowCount = 0;
  let milestoneCount = 0;

  for (const row of parsedRows) {
    const { display, type, active, referral, monthCells } = row;
    const multiType = (typesByDisplay.get(display)?.size ?? 1) > 1;
    const base = multiType ? `${display} — ${type}` : display;

    const seenCount = nameCounts.get(base) ?? 0;
    nameCounts.set(base, seenCount + 1);
    const projectName = seenCount === 0 ? base : `${base} (${seenCount + 1})`;
    if (seenCount >= 1) {
      console.warn(
        `  ! duplicate row for "${base}" — imported as "${projectName}". ` +
          `Re-running after the source rows are reordered may not map back to the same project; merge manually if needed.`
      );
    }

    const referralSourceId = referral ? await upsertReferralSource(referral) : null;
    const clientId = await upsertClient(display);
    const projectId = await upsertProject({
      client_id: clientId,
      name: projectName,
      type,
      active,
      referral_source_id: referralSourceId,
    });

    for (const cell of monthCells) {
      await upsertMonthlyMilestone({ project_id: projectId, monthLabel: cell.label, amount: cell.amount });
      milestoneCount++;
    }

    rowCount++;
  }

  console.log(`INPUT: ${rowCount} projects, ${milestoneCount} monthly milestones imported.`);
}

async function importSowSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("SOW Sent");
  if (!sheet) {
    console.warn('Sheet "SOW Sent" not found — skipping.');
    return;
  }

  const headerRow = sheet.getRow(1);
  const columns: { index: number; label: string }[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const label = cellValue(cell);
    if (typeof label === "string" && label.trim()) {
      columns.push({ index: colNumber, label: label.trim().toUpperCase() });
    }
  });

  const dateCol = columns.find((c) => c.label === "DATE");
  const nameCol = columns.find((c) => c.label === "NAME");
  const feeCol = columns.find((c) => c.label === "FEE");
  const notesCol = columns.find((c) => c.label === "NOTES");

  if (!nameCol) throw new Error('SOW Sent sheet missing "NAME" column');

  let count = 0;
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rawName = cellValue(row.getCell(nameCol.index));
    if (!rawName || typeof rawName !== "string") continue;

    const rawDate = dateCol ? cellValue(row.getCell(dateCol.index)) : null;
    const dateSent = parseSowDate(rawDate);

    const rawFee = feeCol ? cellValue(row.getCell(feeCol.index)) : null;
    const proposedFee = typeof rawFee === "number" ? rawFee : null;

    const rawNotes = notesCol ? cellValue(row.getCell(notesCol.index)) : null;
    const notes = typeof rawNotes === "string" ? rawNotes : null;

    // Status inferred loosely from notes text; defaults to 'Open' otherwise —
    // matches migration mapping note that status inference is best-effort.
    let status = "Open";
    const lowerNotes = (notes ?? "").toLowerCase();
    if (lowerNotes.includes("no response")) status = "No Response";
    else if (lowerNotes.includes("on hold")) status = "On Hold";
    else if (lowerNotes.includes("budget too low") || lowerNotes.includes("declin")) status = "Declined";

    let existingQuery = supabase.from("sow_sent").select("id").eq("prospect_name", rawName);
    existingQuery = dateSent ? existingQuery.eq("date_sent", dateSent) : existingQuery.is("date_sent", null);
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("sow_sent")
        .update({ proposed_fee: proposedFee, notes, status })
        .eq("id", existing.id);
      if (error) throw new Error(`update sow_sent "${rawName}": ${error.message}`);
    } else {
      const { error } = await supabase.from("sow_sent").insert({
        date_sent: dateSent,
        prospect_name: rawName,
        proposed_fee: proposedFee,
        notes,
        status,
      });
      if (error) throw new Error(`insert sow_sent "${rawName}": ${error.message}`);
    }
    count++;
  }

  console.log(`SOW Sent: ${count} rows imported.`);
}

async function main() {
  console.log(`Reading ${XLSX_PATH}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(XLSX_PATH);

  await importInputSheet(workbook);
  await importSowSheet(workbook);

  console.log("Import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
