import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "staff" | "subcontractor";

export async function getMyRole(): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data?.role as Role) ?? null;
}
