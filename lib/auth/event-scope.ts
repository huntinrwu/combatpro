import type { SessionUser } from "./session";

// Promoters only see the events they created. Staff see everything, and so
// do regulators (commission, sanctioning body) and people with no promoter
// role at all, whose view of events is governed by their own module access.
//
// Returns null when the user may see every event, or the user id that
// events.created_by must equal.
export function eventOwnerScope(
  user: Pick<SessionUser, "id" | "isStaff" | "approvedRoles">,
): string | null {
  if (user.isStaff) return null;
  const roles = user.approvedRoles;
  if (!roles.includes("promoter")) return null;
  if (roles.includes("commission") || roles.includes("sanctioning_body")) return null;
  return user.id;
}

export function canViewEvent(
  event: { created_by: string | null },
  user: Pick<SessionUser, "id" | "isStaff" | "approvedRoles">,
): boolean {
  const scope = eventOwnerScope(user);
  return scope === null || event.created_by === scope;
}
