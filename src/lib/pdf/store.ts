import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

type UserDb = Awaited<ReturnType<typeof createClient>>;
type AdminDb = ReturnType<typeof createAdminClient>;

/** Fingerprint of everything a PDF prints, so an unchanged document can reuse its stored file. */
export function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Opens a document's PDF, keeping every version that's ever been generated.
 *
 * The latest stored version is served as-is when it's still current: a quote
 * is current while its printed content is unchanged (`contentHash`), and a
 * contract -- a signed-off record -- stays as generated unless a new version is
 * asked for (`forceNew`). Otherwise the PDF is rendered, stored as the next
 * version in the "documents" bucket, and recorded in `generated_documents`.
 */
export async function serveStoredOrGenerate(opts: {
  db: UserDb;
  admin: AdminDb;
  kind: "quote" | "contract";
  ownerId: string;
  projectId: string;
  contentHash: string;
  total: number | null;
  forceNew: boolean;
  reuseWhileStored: boolean;
  render: () => Promise<Buffer>;
}): Promise<NextResponse> {
  const { db, admin, kind, ownerId } = opts;
  const ownerColumn = kind === "quote" ? "quote_id" : "contract_id";

  const { data: latest, error: latestError } = await db
    .from("generated_documents")
    .select("version, storage_path, content_hash")
    .eq(ownerColumn, ownerId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) return NextResponse.json({ error: latestError.message }, { status: 500 });

  const reusable = latest && !opts.forceNew && (opts.reuseWhileStored || latest.content_hash === opts.contentHash);
  let storagePath: string;

  if (reusable) {
    storagePath = latest.storage_path;
  } else {
    const version = (latest?.version ?? 0) + 1;
    storagePath = `${kind}s/${ownerId}/v${version}.pdf`;
    const buffer = await opts.render();

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const {
      data: { user },
    } = await db.auth.getUser();
    const { error: recordError } = await db.from("generated_documents").insert({
      kind,
      project_id: opts.projectId,
      [ownerColumn]: ownerId,
      version,
      storage_path: storagePath,
      content_hash: opts.contentHash,
      total: opts.total,
      created_by: user?.id ?? null,
    });
    if (recordError) return NextResponse.json({ error: recordError.message }, { status: 500 });

    await db.from(kind === "quote" ? "quotes" : "contracts").update({ pdf_storage_path: storagePath }).eq("id", ownerId);
  }

  const { data: signed, error: signError } = await admin.storage.from("documents").createSignedUrl(storagePath, 60);
  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? "Failed to create a download link." }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
