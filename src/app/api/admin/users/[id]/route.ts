import { NextResponse } from "next/server";
import { getMyRole, type Role } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["owner", "staff", "subcontractor"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getMyRole();
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const admin = createAdminClient();

  if (typeof body.role === "string") {
    const newRole = body.role as Role;
    if (!ROLES.includes(newRole)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    if (newRole !== "owner") {
      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", id)
        .maybeSingle();
      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 500 });
      }
      if (target?.role === "owner") {
        const { count, error: countError } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "owner");
        if (countError) {
          return NextResponse.json({ error: countError.message }, { status: 500 });
        }
        if ((count ?? 0) <= 1) {
          return NextResponse.json({ error: "Cannot remove the last owner." }, { status: 400 });
        }
      }
    }

    const { error } = await admin.from("profiles").update({ role: newRole }).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (typeof body.password === "string") {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
