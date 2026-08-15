import { NextResponse } from "next/server";
import { getMyRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Short-lived signed URL, issued only after an owner check here — never a
// permanent public URL, and the browser session never sees the service-role
// key. Records the download (system_backups + activity_events) before
// redirecting, so a failed redirect can't silently mark something as
// downloaded that never actually started.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getMyRole();
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: backup, error } = await supabase
    .from("system_backups")
    .select("id, storage_path, status, filename")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!backup || backup.status !== "completed" || !backup.storage_path) {
    return NextResponse.json({ error: "Backup not found or not ready for download." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("system-backups")
    .createSignedUrl(backup.storage_path, 60);
  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? "Failed to create a download link." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("system_backups")
    .update({ downloaded_at: new Date().toISOString(), downloaded_by: user?.id ?? null })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("activity_events").insert({
    entity_table: "system_backups",
    entity_id: id,
    event_type: "backup_downloaded",
    summary: `Downloaded ${backup.filename ?? "backup archive"}`,
    source: "ui",
  });

  return NextResponse.redirect(signed.signedUrl);
}
