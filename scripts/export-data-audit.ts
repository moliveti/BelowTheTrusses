/**
 * Exports an Excel workbook auditing what project/scope/subcontractor data
 * is populated vs. missing, so the owner can fill in the blanks offline and
 * re-upload it later to backfill the database.
 *
 * Run with: npx tsx scripts/export-data-audit.ts [output-path]
 */

import dotenv from "dotenv";
import path from "node:path";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { SCOPE_CATEGORIES } from "../src/lib/scope";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FONT = { name: "Calibri", size: 11 };
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
const FILL_IN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2AC" } };

function headerRow(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.addRow(headers);
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function markFillable(cell: ExcelJS.Cell) {
  cell.fill = FILL_IN_FILL;
}

async function main() {
  const [projectsRes, clientsRes, referralRes, scopeTagsRes, projectScopeRes, subsRes, assignRes] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, type, active, state, client_id, referral_source_id, contract_signed_date, contract_value, billing_method, hourly_rate, fixed_fee_amount, addon_hours, addon_hourly_rate, furniture_commission_rate, furniture_sale_total, start_date, target_completion_date, actual_completion_date, notes"
      )
      .order("name"),
    supabase.from("clients").select("id, name"),
    supabase.from("referral_sources").select("id, name"),
    supabase.from("scope_tags").select("id, name"),
    supabase.from("project_scope_tags").select("project_id, scope_tag_id, amount"),
    supabase.from("subcontractors").select("id, name").order("name"),
    supabase.from("project_subcontractors").select("project_id, subcontractor_id, hourly_rate, allocated_hours"),
  ]);

  for (const [label, res] of Object.entries({
    projects: projectsRes,
    clients: clientsRes,
    referral: referralRes,
    scopeTags: scopeTagsRes,
    projectScope: projectScopeRes,
    subs: subsRes,
    assign: assignRes,
  })) {
    const typed = res as { error: { message: string } | null };
    if (typed.error) throw new Error(`${label}: ${typed.error.message}`);
  }

  const clientNameById = new Map((clientsRes.data ?? []).map((c) => [c.id, c.name]));
  const referralNameById = new Map((referralRes.data ?? []).map((r) => [r.id, r.name]));
  const scopeTagNameById = new Map((scopeTagsRes.data ?? []).map((s) => [s.id, s.name]));
  const subcontractors = subsRes.data ?? [];

  const projectScopeByProject = new Map<string, Map<string, number>>();
  for (const ps of projectScopeRes.data ?? []) {
    if (!projectScopeByProject.has(ps.project_id)) projectScopeByProject.set(ps.project_id, new Map());
    const name = scopeTagNameById.get(ps.scope_tag_id) ?? "Unknown";
    projectScopeByProject.get(ps.project_id)!.set(name, ps.amount);
  }

  const assignmentsByProject = new Map<
    string,
    { subcontractorId: string; rate: number | null; hours: number | null }[]
  >();
  for (const a of assignRes.data ?? []) {
    if (!assignmentsByProject.has(a.project_id)) assignmentsByProject.set(a.project_id, []);
    assignmentsByProject
      .get(a.project_id)!
      .push({ subcontractorId: a.subcontractor_id, rate: a.hourly_rate, hours: a.allocated_hours });
  }
  const subNameById = new Map(subcontractors.map((s) => [s.id, s.name]));

  const projects = (projectsRes.data ?? []).sort((a, b) => {
    const clientA = clientNameById.get(a.client_id) ?? "";
    const clientB = clientNameById.get(b.client_id) ?? "";
    return clientA.localeCompare(clientB) || a.name.localeCompare(b.name);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Below the Trusses";
  wb.created = new Date();

  // ---------- Read Me ----------
  const readme = wb.addWorksheet("Read Me");
  readme.getColumn(1).width = 100;
  const lines: [string, boolean][] = [
    ["Below the Trusses — Data Completeness Audit", true],
    ["", false],
    ["This workbook lists every project alongside the fields the forecast tool needs to make", false],
    ["the dashboard, cost tracking, and profitability views fully useful. Cells shaded yellow", false],
    ["are blank in the database today — fill in whatever you know and leave the rest blank.", false],
    ["", false],
    ["Sheets:", true],
    ["  Projects — one row per project: dates, planned revenue, billing terms, state, notes.", false],
    ["  Scope Tags (Residential) — dollar breakdown by scope category, Residential projects only.", false],
    ["  Subcontractor Assignments — one blank row per active project; add a Subcontractor,", false],
    ["    Hourly Rate, and Allocated Hours. Duplicate the row if more than one person works a project.", false],
    ["", false],
    ["Do not rename columns, sheets, or add new columns — the re-import script matches by", false],
    ["these exact headers. Once filled in, send the file back and it can be re-imported —", false],
    ["existing data is only ever filled in, never overwritten.", false],
  ];
  for (const [text, bold] of lines) {
    const row = readme.addRow([text]);
    row.getCell(1).font = { ...FONT, bold, size: bold ? 14 : 11 };
    row.getCell(1).alignment = { wrapText: true };
  }

  // ---------- Projects ----------
  const sheet = wb.addWorksheet("Projects");
  const projectHeaders = [
    "Client",
    "Project",
    "Type",
    "Active",
    "State",
    "Referral Source",
    "Contract Signed Date",
    "Planned Revenue ($)",
    "Billing Method",
    "Hourly Rate ($)",
    "Fixed Fee Amount ($)",
    "Add-on Hours",
    "Add-on Hourly Rate ($)",
    "Furniture Commission Rate (ref only, 0-1)",
    "Furniture Sale Total (ref only, $)",
    "Start Date",
    "Target Completion Date",
    "Actual Completion Date",
    "Notes",
  ];
  headerRow(sheet, projectHeaders);
  sheet.columns = projectHeaders.map((h) => ({ width: Math.max(14, Math.min(28, h.length + 4)) }));

  for (const p of projects) {
    const row = sheet.addRow([
      clientNameById.get(p.client_id) ?? "",
      p.name,
      p.type,
      p.active ? "Yes" : "No",
      p.state ?? "",
      p.referral_source_id ? referralNameById.get(p.referral_source_id) ?? "" : "",
      p.contract_signed_date ?? "",
      p.contract_value ?? "",
      p.billing_method ?? "",
      p.hourly_rate ?? "",
      p.fixed_fee_amount ?? "",
      p.addon_hours ?? "",
      p.addon_hourly_rate ?? "",
      p.furniture_commission_rate ?? "",
      p.furniture_sale_total ?? "",
      p.start_date ?? "",
      p.target_completion_date ?? "",
      p.actual_completion_date ?? "",
      p.notes ?? "",
    ]);
    row.eachCell((cell) => (cell.font = FONT));
    if (!p.state) markFillable(row.getCell(5));
    if (!p.contract_signed_date) markFillable(row.getCell(7));
    if (p.contract_value === null) markFillable(row.getCell(8));
    if (p.hourly_rate === null) markFillable(row.getCell(10));
    if (p.fixed_fee_amount === null) markFillable(row.getCell(11));
    if (p.addon_hours === null) markFillable(row.getCell(12));
    if (p.type === "Furniture" && p.furniture_commission_rate === null) markFillable(row.getCell(14));
    if (p.type === "Furniture" && p.furniture_sale_total === null) markFillable(row.getCell(15));
    if (!p.start_date) markFillable(row.getCell(16));
    if (!p.target_completion_date) markFillable(row.getCell(17));
  }

  // ---------- Scope Tags (Residential) ----------
  const scopeSheet = wb.addWorksheet("Scope Tags (Residential)");
  const scopeHeaders = ["Client", "Project", ...SCOPE_CATEGORIES.map((c) => `${c} ($)`), "Notes"];
  headerRow(scopeSheet, scopeHeaders);
  scopeSheet.columns = scopeHeaders.map((h) => ({ width: Math.max(14, Math.min(24, h.length + 2)) }));

  for (const p of projects.filter((proj) => proj.type === "Residential")) {
    const existing = projectScopeByProject.get(p.id) ?? new Map<string, number>();
    const values = SCOPE_CATEGORIES.map((cat) => existing.get(cat) ?? "");
    const row = scopeSheet.addRow([clientNameById.get(p.client_id) ?? "", p.name, ...values, ""]);
    row.eachCell((cell) => (cell.font = FONT));
    values.forEach((v, i) => {
      if (v === "") markFillable(row.getCell(3 + i));
    });
  }

  // ---------- Subcontractor Assignments ----------
  const assignSheet = wb.addWorksheet("Subcontractor Assignments");
  const assignHeaders = ["Client", "Project", "Subcontractor", "Hourly Rate ($)", "Allocated Hours"];
  headerRow(assignSheet, assignHeaders);
  assignSheet.columns = assignHeaders.map((h) => ({ width: Math.max(16, h.length + 4) }));

  for (const p of projects.filter((proj) => proj.active)) {
    const existing = assignmentsByProject.get(p.id) ?? [];
    if (existing.length === 0) {
      const row = assignSheet.addRow([clientNameById.get(p.client_id) ?? "", p.name, "", "", ""]);
      row.eachCell((cell) => (cell.font = FONT));
      markFillable(row.getCell(3));
      markFillable(row.getCell(4));
      markFillable(row.getCell(5));
    } else {
      for (const a of existing) {
        const row = assignSheet.addRow([
          clientNameById.get(p.client_id) ?? "",
          p.name,
          subNameById.get(a.subcontractorId) ?? "",
          a.rate ?? "",
          a.hours ?? "",
        ]);
        row.eachCell((cell) => (cell.font = FONT));
        if (a.rate === null) markFillable(row.getCell(4));
        if (a.hours === null) markFillable(row.getCell(5));
      }
    }
  }

  const refRow = assignSheet.addRow([]);
  refRow.getCell(1).value = "Reference — subcontractor names:";
  refRow.getCell(1).font = { ...FONT, bold: true };
  for (const s of subcontractors) {
    const row = assignSheet.addRow(["", "", s.name]);
    row.eachCell((cell) => (cell.font = FONT));
  }

  const outPath = process.argv[2] ?? path.resolve(__dirname, "../BTT_Data_Audit.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log(`Wrote ${outPath}`);
  console.log(`Projects: ${projects.length}, Residential: ${projects.filter((p) => p.type === "Residential").length}, Active: ${projects.filter((p) => p.active).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
