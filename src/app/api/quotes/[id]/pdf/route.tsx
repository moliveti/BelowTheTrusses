import { NextResponse } from "next/server";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getMyRole } from "@/lib/profile";
import { canBuildQuotes } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLogoBuffer } from "@/lib/pdf/logo";
import { COMPANY_INFO } from "@/lib/pdf/companyInfo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  leftCol: { flexShrink: 1 },
  rightCol: { alignItems: "flex-end" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 2 },
  validityLine: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 14 },
  logo: { width: 150, marginBottom: 8 },
  boldLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 4 },
  clientNameText: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 },
  leftText: { fontSize: 10, color: "#333", marginBottom: 1 },
  rightText: { fontSize: 10, textAlign: "right", color: "#333", marginBottom: 1 },
  companyLine: { fontSize: 9, textAlign: "right", marginBottom: 2 },
  paymentTerms: { marginBottom: 18 },
  paymentTermsLine: { fontSize: 10, marginTop: 4 },
  sectionHeader: { fontSize: 9, textTransform: "uppercase", color: "#888", marginTop: 14, marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 3 },
  taskCol: { flex: 3 },
  hoursCol: { flex: 1, textAlign: "right" },
  totalsBlock: { marginTop: 20, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 220, justifyContent: "space-between", marginBottom: 2 },
  grandTotal: { fontSize: 13, marginTop: 4 },
});

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface PaymentTerm {
  label: string;
  // null when the split isn't a fixed rule (Commercial/Furniture amounts
  // are set later, at contract time) -- only Residential's quote-stage
  // formula below is precise enough to state a figure now.
  amount: number | null;
}

// Residential: if the quote is Construction Documents scope only (no other
// section has hours), it's a 2-payment split -- 50% at signing, 50% when
// documents are sent to the client. Otherwise it's the standard 4-payment
// structure: the 3rd and 4th payments are a fixed $500 each, and whatever
// remains of the total is split evenly across the 1st and 2nd.
function residentialPaymentTerms(
  lineItems: { section: string; hours: number }[],
  total: number
): PaymentTerm[] {
  const hasNonCdWork = lineItems.some((li) => li.section !== "Construction Documents" && li.hours > 0);
  if (!hasNonCdWork) {
    const half = total / 2;
    return [
      { label: "1st Payment — due upon Signed Contract", amount: half },
      { label: "2nd Payment — due when Documents are Sent to Client", amount: half },
    ];
  }
  const fixedPayment = 500;
  const remainder = Math.max(0, total - fixedPayment * 2);
  const split = remainder / 2;
  return [
    { label: "1st Payment — due upon Signed Contract", amount: split },
    { label: "2nd Payment — due when Construction Documents are sent to the GC for bidding", amount: split },
    { label: "3rd Payment — due at the Electrical/Plumbing Rough-In Walkthrough", amount: fixedPayment },
    { label: "4th and Final Payment — due after the Final Punch Walkthrough", amount: fixedPayment },
  ];
}

function nonResidentialPaymentTerms(projectType: string): PaymentTerm[] {
  if (projectType === "Commercial") {
    return [
      { label: "Initial Payment — due upon Signed Contract", amount: null },
      { label: "Final Payment — due upon Substantial Completion of the Project", amount: null },
    ];
  }
  return [{ label: "Billed hourly at the Project Management rate, invoiced monthly based on hours worked", amount: null }];
}

interface QuotePdfProps {
  logo: Buffer;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadState: string | null;
  projectType: string;
  createdAt: string;
  lineItems: { section: string; taskName: string; hours: number; rate: number; amount: number }[];
  paymentTerms: PaymentTerm[];
  subtotal: number;
  discountLabel: string | null;
  discountAmount: number;
  pmFeeLabel: string | null;
  pmFeeAmount: number;
  total: number;
}

function QuotePdf(props: QuotePdfProps) {
  const sections = Array.from(new Set(props.lineItems.map((li) => li.section)));
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.leftCol}>
            <Text style={styles.title}>{props.projectType} Quote</Text>
            <Text style={styles.validityLine}>
              Valid from {new Date(props.createdAt).toLocaleDateString()} for 30 days only.
            </Text>
            <Text style={styles.boldLabel}>Prepared for:</Text>
            <Text style={styles.clientNameText}>{props.leadName}</Text>
            {props.leadState && <Text style={styles.leftText}>{props.leadState}</Text>}
            {props.leadPhone && <Text style={styles.leftText}>Tel: {props.leadPhone}</Text>}
            {props.leadEmail && <Text style={styles.leftText}>Email: {props.leadEmail}</Text>}
          </View>
          <View style={styles.rightCol}>
            <Image src={props.logo} style={styles.logo} />
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
        </View>

        <View style={styles.paymentTerms}>
          <Text style={styles.boldLabel}>Payment Terms:</Text>
          {props.paymentTerms.map((term, i) => (
            <Text key={i} style={styles.paymentTermsLine}>
              {term.label}
              {term.amount !== null ? `: ${fmtUsd(term.amount)}` : ""}
            </Text>
          ))}
        </View>

        {sections.map((section) => (
          <View key={section}>
            <Text style={styles.sectionHeader}>{section}</Text>
            {props.lineItems
              .filter((li) => li.section === section)
              .map((li, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.taskCol}>{li.taskName}</Text>
                  <Text style={styles.hoursCol}>{li.hours} hrs</Text>
                </View>
              ))}
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{fmtUsd(props.subtotal)}</Text>
          </View>
          {props.discountLabel && (
            <View style={styles.totalsRow}>
              <Text>{props.discountLabel}</Text>
              <Text>-{fmtUsd(props.discountAmount)}</Text>
            </View>
          )}
          {props.pmFeeLabel && (
            <View style={styles.totalsRow}>
              <Text>{props.pmFeeLabel}</Text>
              <Text>{fmtUsd(props.pmFeeAmount)}</Text>
            </View>
          )}
          <Text style={styles.grandTotal}>Total: {fmtUsd(props.total)}</Text>
        </View>
      </Page>
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

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, project_type, discount_type, discount_value, pm_hourly_rate, pm_estimated_hours, subtotal, total, created_at, leads(name, email, phone, state)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!quote) return NextResponse.json({ error: "Quote not found." }, { status: 404 });

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("section, task_name, hours, rate, amount")
    .eq("quote_id", id)
    .order("sequence_order");
  if (lineItemsError) return NextResponse.json({ error: lineItemsError.message }, { status: 500 });

  const lead = Array.isArray(quote.leads) ? quote.leads[0] : quote.leads;
  const discountAmount = quote.subtotal - (quote.total - (quote.pm_hourly_rate && quote.pm_estimated_hours ? quote.pm_hourly_rate * quote.pm_estimated_hours : 0));
  const pmFeeAmount = quote.pm_hourly_rate && quote.pm_estimated_hours ? quote.pm_hourly_rate * quote.pm_estimated_hours : 0;
  const mappedLineItems = (lineItems ?? []).map((li) => ({
    section: li.section,
    taskName: li.task_name,
    hours: li.hours,
    rate: li.rate,
    amount: li.amount,
  }));
  const paymentTerms =
    quote.project_type === "Residential"
      ? residentialPaymentTerms(mappedLineItems, quote.total)
      : nonResidentialPaymentTerms(quote.project_type);

  const buffer = await renderToBuffer(
    <QuotePdf
      logo={getLogoBuffer()}
      leadName={lead?.name ?? "Client"}
      leadEmail={lead?.email ?? null}
      leadPhone={lead?.phone ?? null}
      leadState={lead?.state ?? null}
      projectType={quote.project_type}
      createdAt={quote.created_at}
      lineItems={mappedLineItems}
      paymentTerms={paymentTerms}
      subtotal={quote.subtotal}
      discountLabel={quote.discount_type ? (quote.discount_type === "percent" ? `Discount (${quote.discount_value}%)` : "Discount") : null}
      discountAmount={discountAmount}
      pmFeeLabel={pmFeeAmount > 0 ? "Project Management (est.)" : null}
      pmFeeAmount={pmFeeAmount}
      total={quote.total}
    />
  );

  const storagePath = `quotes/${id}.pdf`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  await supabase.from("quotes").update({ pdf_storage_path: storagePath }).eq("id", id);

  const { data: signed, error: signError } = await admin.storage.from("documents").createSignedUrl(storagePath, 60);
  if (signError || !signed) return NextResponse.json({ error: signError?.message ?? "Failed to create a download link." }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
