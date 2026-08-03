/**
 * One-off admin script: create/update the two full-access users (owner +
 * Amy Oliveti) with a password, and make sure their profile role is 'owner'.
 *
 * Run with: npx tsx scripts/setup-users.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS/Auth email
 * verification — never run this client-side).
 */

import dotenv from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const USERS = [
  { email: "mariano.oliveti@yahoo.com", password: "BTT123" },
  { email: "info@belowthetrusses.com", password: "BTT123" },
];

async function findUserByEmail(email: string) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page++;
  }
}

async function main() {
  for (const { email, password } of USERS) {
    const existing = await findUserByEmail(email);
    let userId: string;

    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`update ${email}: ${error.message}`);
      userId = existing.id;
      console.log(`updated password for existing user ${email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`create ${email}: ${error.message}`);
      userId = data.user.id;
      console.log(`created user ${email}`);
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, role: "owner" }, { onConflict: "id" });
    if (profileError) throw new Error(`upsert profile for ${email}: ${profileError.message}`);
    console.log(`  profile role set to 'owner' for ${email}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
