import { NextResponse } from "next/server";
import { getMyRole } from "@/lib/profile";
import { canBuildQuotes } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Opens one saved quote/contract PDF exactly as it was generated -- never re-rendered from current data. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getMyRole();
  if (!canBuildQuotes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: record, error } = await supabase.from("generated_documents").select("storage_path").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!record) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const { data: signed, error: signError } = await createAdminClient().storage
    .from("documents")
    .createSignedUrl(record.storage_path, 60);
  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? "That file is no longer in storage." }, { status: 404 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
