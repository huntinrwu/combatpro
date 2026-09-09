import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PLATFORM_ROLES, canCreateEvents, type PlatformRole } from "./roles";

// isStaff + approvedRoles are the EFFECTIVE view (respect the view-as
// override). actualIsStaff + viewAsRole let staff-only UI reveal the override
// controls and banner without lying about the identity.
//
// isStaff semantic: "elevated" — true if the profile is is_staff OR is_admin.
// Admin is a strict superset of staff (admin can do everything staff can). Use
// isAdmin only when gating something admin-only (billing, role grants, etc).
export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  isStaff: boolean;
  actualIsStaff: boolean;
  isAdmin: boolean;
  actualIsAdmin: boolean;
  approvedRoles: PlatformRole[];
  pendingRoles: PlatformRole[];
  viewAsRole: PlatformRole | null;
  // Set when an admin is previewing the app as an employee — same edit surface
  // as staff, but no user-management (isAdmin becomes false).
  viewAsEmployee: boolean;
};

const VIEW_AS_COOKIE = "cp:view-as";

// Cached per request. Anon (unsigned) → null.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Admin client dodges the RLS trip round-trip on profiles/grants for the
  // owning user (the RLS policies allow it anyway; this is just latency).
  const admin = createAdminClient();

  const [{ data: profile }, { data: grants }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, is_staff, is_admin")
      .eq("id", user.id)
      .maybeSingle<{
        id: string;
        email: string;
        full_name: string | null;
        is_staff: boolean;
        is_admin: boolean;
      }>(),
    admin
      .from("user_role_grants")
      .select("role, status")
      .eq("user_id", user.id),
  ]);

  if (!profile) return null;

  const approvedRoles: PlatformRole[] = [];
  const pendingRoles: PlatformRole[] = [];
  for (const g of (grants ?? []) as { role: PlatformRole; status: string }[]) {
    if (g.status === "approved") approvedRoles.push(g.role);
    else if (g.status === "pending") pendingRoles.push(g.role);
  }

  // Admin is a strict superset of staff for permission purposes.
  const rawElevated = profile.is_staff || profile.is_admin;

  const jar = await cookies();
  const rawViewAs = jar.get(VIEW_AS_COOKIE)?.value ?? null;
  const viewAsRole =
    rawElevated && rawViewAs && (PLATFORM_ROLES as readonly string[]).includes(rawViewAs)
      ? (rawViewAs as PlatformRole)
      : null;
  // Employee view is admin-only — a demote from admin down to staff. Regular
  // staff selecting "employee" would be a no-op, so we ignore it.
  const viewAsEmployee = profile.is_admin && rawViewAs === "employee" && !viewAsRole;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    isStaff: viewAsRole ? false : rawElevated,
    actualIsStaff: profile.is_staff,
    isAdmin: viewAsRole || viewAsEmployee ? false : profile.is_admin,
    actualIsAdmin: profile.is_admin,
    approvedRoles: viewAsRole ? [viewAsRole] : approvedRoles,
    pendingRoles,
    viewAsRole,
    viewAsEmployee,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isStaff) redirect("/");
  return user;
}

export async function requireEventCreator(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canCreateEvents(user.approvedRoles, user.isStaff)) redirect("/events");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
