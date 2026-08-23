import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getMyRole } from "@/lib/profile";
import { canBuildQuotes } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 20 },
  sectionHeader: { fontSize: 9, textTransform: "uppercase", color: "#888", marginTop: 14, marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 3 },
  taskCol: { flex: 3 },
  hoursCol: { flex: 1, textAlign: "right" },
  rateCol: { flex: 1, textAlign: "right" },
  amountCol: { flex: 1, textAlign: "right" },
  totalsBlock: { marginTop: 20, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 220, justifyContent: "space-between", marginBottom: 2 },
  grandTotal: { fontSize: 13, marginTop: 4 },
});

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface QuotePdfProps {
  leadName: string;
  projectType: string;
  createdAt: string;
  lineItems: { section: string; taskName: string; hours: number; rate: number; amount: number }[];
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
        <Text style={styles.title}>Below the Trusses — Quote</Text>
        <Text style={styles.subtitle}>
          {props.leadName} · {props.projectType} · {new Date(props.createdAt).toLocaleDateString()}
        </Text>

        {sections.map((section) => (
          <View key={section}>
            <Text style={styles.sectionHeader}>{section}</Text>
            {props.lineItems
              .filter((li) => li.section === section)
              .map((li, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.taskCol}>{li.taskName}</Text>
                  <Text style={styles.hoursCol}>{li.hours} hrs</Text>
                  <Text style={styles.rateCol}>{fmtUsd(li.rate)}/hr</Text>
                  <Text style={styles.amountCol}>{fmtUsd(li.amount)}</Text>
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
      "id, project_type, discount_type, discount_value, pm_hourly_rate, pm_estimated_hours, subtotal, total, created_at, leads(name)"
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

  const buffer = await renderToBuffer(
    <QuotePdf
      leadName={lead?.name ?? "Client"}
      projectType={quote.project_type}
      createdAt={quote.created_at}
      lineItems={(lineItems ?? []).map((li) => ({ section: li.section, taskName: li.task_name, hours: li.hours, rate: li.rate, amount: li.amount }))}
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
