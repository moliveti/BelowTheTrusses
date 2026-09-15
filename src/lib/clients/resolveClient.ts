import type { createClient } from "@/lib/supabase/client";
import type { ClientOption } from "./types";

export interface PickedClient {
  id: string | null;
  name: string;
}

/**
 * Turns a ClientPicker selection into a concrete client id. A picked id is
 * used as-is; otherwise an exact case-insensitive name match against the
 * already-loaded client list is used (covers typing an existing name
 * without clicking the suggestion) before falling back to creating a new
 * client row. Replaces the old upsert(onConflict:"name") pattern, which
 * merged or created based purely on exact string equality with no
 * visibility into which happened.
 */
export async function resolveClientId(
  supabase: ReturnType<typeof createClient>,
  clients: ClientOption[],
  picked: PickedClient
): Promise<{ id: string } | { error: string }> {
  if (picked.id) return { id: picked.id };

  const name = picked.name.trim();
  if (!name) return { error: "Client name is required." };

  const existing = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return { id: existing.id };

  const { data, error } = await supabase.from("clients").insert({ name }).select("id").single();
  if (error) return { error: error.message };
  return { id: data.id };
}
