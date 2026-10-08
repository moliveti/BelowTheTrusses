import { NextResponse } from "next/server";
import { getMyRole, type Role } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["owner", "staff", "subcontractor"];

export async function POST(request: Request) {
  const role = await getMyRole();
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const newRole = body.role as Role;
  // Only meaningful when newRole === "subcontractor": an existing
  // subcontractors.id to link this login to, or "" to insert a new
  // subcontractors row for them instead.
  const subcontractorId = typeof body.subcontractorId === "string" ? body.subcontractorId : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!ROLES.includes(newRole)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // The on_auth_user_created trigger already inserted a profiles row with the
  // least-privileged default role ('subcontractor'), so the requested role --
  // owner included -- always has to be set explicitly here.
  const { error: roleError } = await admin.from("profiles").update({ role: newRole }).eq("id", data.user.id);
  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  // A subcontractor login is useless without being linked to the
  // subcontractors row the rest of the app (rates, hours, the
  // my_subcontractor view) actually keys off.
  if (newRole === "subcontractor") {
    if (subcontractorId) {
      const { error: linkError } = await admin
        .from("subcontractors")
        .update({ user_id: data.user.id })
        .eq("id", subcontractorId);
      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    } else {
      const { error: subError } = await admin
        .from("subcontractors")
        .insert({ name: fullName || email, user_id: data.user.id });
      if (subError) {
        return NextResponse.json({ error: subError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ id: data.user.id });
}
