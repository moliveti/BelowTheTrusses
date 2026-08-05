import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamMember } from "./types";

export async function getTeamMembers(): Promise<TeamMember[]> {
  const admin = createAdminClient();
  const [usersResult, profilesResult] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from("profiles").select("id, full_name, role"),
  ]);
  if (usersResult.error) throw new Error(`auth.admin.listUsers: ${usersResult.error.message}`);
  if (profilesResult.error) throw new Error(`profiles: ${profilesResult.error.message}`);

  const profileById = new Map(
    (profilesResult.data ?? []).map((p: { id: string; full_name: string | null; role: string }) => [p.id, p])
  );

  return usersResult.data.users
    .map((u) => {
      const profile = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        fullName: profile?.full_name ?? null,
        role: (profile?.role as TeamMember["role"]) ?? "owner",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}
