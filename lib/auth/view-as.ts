"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { PLATFORM_ROLES } from "./roles";
import { getSessionUser } from "./session";

// Value is a PlatformRole or absent.
const VIEW_AS_COOKIE = "cp:view-as";
const ONE_MONTH = 60 * 60 * 24 * 30;

export async function setViewAsRole(fd: FormData) {
  // Actual staff check — respects actualIsStaff so a staff already viewing as
  // fighter can still switch or reset.
  const u = await getSessionUser();
  if (!u?.actualIsStaff) return;

  const role = fd.get("role")?.toString();
  const jar = await cookies();
  const isPlatform = role && (PLATFORM_ROLES as readonly string[]).includes(role);
  // "employee" is a special view for actual admins only.
  const isEmployee = role === "employee" && u.actualIsAdmin;
  if (role && (isPlatform || isEmployee)) {
    jar.set(VIEW_AS_COOKIE, role, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_MONTH,
    });
  } else {
    jar.delete(VIEW_AS_COOKIE);
  }
  revalidatePath("/", "layout");
}

export async function clearViewAsRole() {
  const u = await getSessionUser();
  if (!u?.actualIsStaff) return;
  const jar = await cookies();
  jar.delete(VIEW_AS_COOKIE);
  revalidatePath("/", "layout");
}
