import { NextResponse } from "next/server";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getMyRole } from "@/lib/profile";
import { canBuildQuotes } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildResidentialFurnitureContract,
  buildCommercialContract,
  type ContractDocument,
} from "@/lib/contracts/schedules";
import { getLogoBuffer } from "@/lib/pdf/logo";
import { COMPANY_INFO } from "@/lib/pdf/companyInfo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 150 },
  preparedFor: { alignItems: "flex-end" },
  boldLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 4 },
  clientNameText: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2, textAlign: "right" },
  rightText: { fontSize: 10, textAlign: "right", color: "#333", marginBottom: 1 },
  companyBlock: { marginBottom: 14 },
  companyLine: { fontSize: 10, marginBottom: 3 },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 20 },
  scheduleTitle: { fontSize: 13, marginBottom: 10, textTransform: "uppercase" },
  body: { fontSize: 10, marginBottom: 8 },
  scheduleListItem: { fontSize: 10, marginBottom: 3 },
  signatureBlock: { marginTop: 30 },
  signatureLine: { borderBottomWidth: 0.5, borderBottomColor: "#000", width: 260, marginTop: 24, marginBottom: 4 },
});

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function ContractPdf({
  logo,
  clientName,
  clientEmail,
  clientPhone,
  clientState,
  projectName,
  doc,
  initialPaymentLine,
}: {
  logo: Buffer;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientState: string | null;
  projectName: string;
  doc: ContractDocument;
  initialPaymentLine: string;
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topRow}>
          <Image src={logo} style={styles.logo} />
          <View style={styles.preparedFor}>
            <Text style={styles.boldLabel}>Prepared for:</Text>
            <Text style={styles.clientNameText}>{clientName}</Text>
            {clientState && <Text style={styles.rightText}>{clientState}</Text>}
            {clientPhone && <Text style={styles.rightText}>Tel: {clientPhone}</Text>}
            {clientEmail && <Text style={styles.rightText}>Email: {clientEmail}</Text>}
          </View>
        </View>

        <View style={styles.companyBlock}>
          <Text style={styles.companyLine}>
            <Text style={styles.boldLabel}>Email: </Text>
            {COMPANY_INFO.email}
          </Text>
          <Text style={styles.companyLine}>
            <Text style={styles.boldLabel}>Tel: </Text>
            {COMPANY_INFO.phone}
          </Text>
          <Text style={styles.companyLine}>
            <Text style={styles.boldLabel}>Business Hours: </Text>
            {COMPANY_INFO.hours}
          </Text>
        </View>

        <Text style={styles.title}>Below the Trusses — Design Services Agreement</Text>
        <Text style={styles.subtitle}>{projectName}</Text>
        <Text style={styles.body}>
          This letter, including all of the schedules referenced in this letter (our "Agreement") confirms our
          understanding concerning the interior design services to be rendered by our firm Below the Trusses (the
          "Designer" or "us") with respect to your project (the "Project").
        </Text>
        <Text style={[styles.body, { marginTop: 10, marginBottom: 6 }]}>{doc.scheduleListTitle}</Text>
        {doc.schedules.map((s) => (
          <Text key={s.letter} style={styles.scheduleListItem}>
            Schedule {s.letter} — "{s.title}"
          </Text>
        ))}
        <Text style={[styles.body, { marginTop: 14 }]}>{initialPaymentLine}</Text>

        <View style={styles.signatureBlock}>
          <Text>AGREED AND ACCEPTED:</Text>
          <View style={styles.signatureLine} />
          <Text>By (Client)                                          Date</Text>
          <View style={styles.signatureLine} />
          <Text>By: Amy Oliveti, Owner, Below the Trusses     Date</Text>
        </View>
      </Page>

      {doc.schedules.map((s) => (
        <Page key={s.letter} size="LETTER" style={styles.page}>
          <Text style={styles.scheduleTitle}>
            Schedule {s.letter} — {s.title}
          </Text>
          {s.body.split("\n\n").map((para, i) => (
            <Text key={i} style={styles.body}>
              {para}
            </Text>
          ))}
        </Page>
      ))}
    </Document>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getMyRole();
  if (!canBuildQuotes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(
      "id, project_id, template_variant, discount_type, discount_value, pm_hourly_rate, pm_estimated_hours, design_fee_total, payment3_amount, payment4_amount, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contract) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  const [projectRes, milestonesRes, quoteLineItemsRes] = await Promise.all([
    supabase.from("projects").select("name, type, state, hourly_rate, furniture_commission_rate, clients(name)").eq("id", contract.project_id).maybeSingle(),
    supabase.from("milestones").select("name, due_date, amount_due, sequence_order").eq("project_id", contract.project_id).order("sequence_order"),
    supabase
      .from("quotes")
      .select("id, quote_line_items(task_name, hours), leads(email, phone)")
      .eq("project_id", contract.project_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 500 });
  if (!projectRes.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const project = projectRes.data;
  const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;
  const clientName = client?.name ?? "Client";
  const lead = Array.isArray(quoteLineItemsRes.data?.leads) ? quoteLineItemsRes.data.leads[0] : quoteLineItemsRes.data?.leads;
  const clientEmail = lead?.email ?? null;
  const clientPhone = lead?.phone ?? null;

  const scopeLines = (quoteLineItemsRes.data?.quote_line_items ?? [])
    .filter((li: { hours: number }) => li.hours > 0)
    .map((li: { task_name: string; hours: number }) => `${li.task_name} (${li.hours} hrs)`);
  const scopeOfWork = scopeLines.length > 0 ? scopeLines.join("\n") : "See attached scope of work.";

  const paymentScheduleLines = (milestonesRes.data ?? [])
    .map((m) => `${m.name}: ${fmtUsd(m.amount_due ?? 0)}${m.due_date ? ` (due ${m.due_date})` : ""}`)
    .join("\n");

  const hourlyRate = fmtUsd(project.hourly_rate ?? 200);
  const pmFeeClause = contract.pm_hourly_rate
    ? `Project Management. Project Management services, when engaged by you, are billed hourly at our Project Management rate of ${fmtUsd(
        contract.pm_hourly_rate
      )} per hour, in addition to the Design Fee.`
    : "";

  const designFeeTotal = contract.design_fee_total ?? 0;
  const designFeeAmount = fmtUsd(designFeeTotal);
  const purchasingFeePercent = String(Math.round((project.furniture_commission_rate ?? 0.2) * 100));

  let doc: ContractDocument;
  if (contract.template_variant === "Commercial") {
    doc = buildCommercialContract({
      agreementDate: new Date(contract.created_at).toLocaleDateString(),
      clientName,
      projectAddress: "[Project Address]",
      scopeOfWork,
      designFeeWords: designFeeAmount,
      designFeeAmount,
      paymentScheduleLines,
      hourlyRate,
      pmFeeClause,
    });
  } else {
    doc = buildResidentialFurnitureContract({
      scopeOfWork,
      budget: designFeeAmount,
      designFeeWords: designFeeAmount,
      designFeeAmount,
      paymentScheduleLines,
      hourlyRate,
      pmFeeClause,
      includeFurnitureSchedules: contract.template_variant === "Furniture",
      purchasingFeePercent,
    });
  }

  const firstMilestone = (milestonesRes.data ?? [])[0];
  const initialPaymentLine = firstMilestone
    ? `We ask that you confirm the foregoing by signing and returning a copy of this letter together with the sum of ${fmtUsd(
        firstMilestone.amount_due ?? 0
      )}, representing "${firstMilestone.name}."`
    : "We ask that you confirm the foregoing by signing and returning a copy of this letter.";

  const buffer = await renderToBuffer(
    <ContractPdf
      logo={getLogoBuffer()}
      clientName={clientName}
      clientEmail={clientEmail}
      clientPhone={clientPhone}
      clientState={project.state}
      projectName={project.name}
      doc={doc}
      initialPaymentLine={initialPaymentLine}
    />
  );

  const storagePath = `contracts/${id}.pdf`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  await supabase.from("contracts").update({ pdf_storage_path: storagePath }).eq("id", id);

  const { data: signed, error: signError } = await admin.storage.from("documents").createSignedUrl(storagePath, 60);
  if (signError || !signed) return NextResponse.json({ error: signError?.message ?? "Failed to create a download link." }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
