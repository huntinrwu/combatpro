export const PLATFORM_ROLES = [
  "fighter",
  "coach",
  "gym_owner",
  "commission",
  "sanctioning_body",
  "official",
  "promoter",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ROLE_LABELS: Record<PlatformRole, string> = {
  fighter: "Fighter",
  coach: "Coach",
  gym_owner: "Gym Owner",
  commission: "Commission",
  sanctioning_body: "Sanctioning Body",
  official: "Official",
  promoter: "Promoter",
};

export const ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  fighter: "Athlete competing in bouts. Manages own profile, medicals, licenses.",
  coach: "Corners fighters at events. Linked to a gym.",
  gym_owner: "Operates a gym. Manages roster, coaches, upcoming bouts.",
  commission: "State athletic commission staff. Reviews sanctioning + medicals.",
  sanctioning_body: "SB staff — sanctions events, verifies rulesets + officials.",
  official: "Referees, judges, timekeepers, doctors, inspectors.",
  promoter: "Runs events. Full access to their card, sponsors, payouts.",
};

// Which platform roles need to pick / propose a gym at signup.
export const ROLES_REQUIRING_GYM: PlatformRole[] = ["coach", "gym_owner"];

// Map module slug → platform roles allowed to see it. Staff bypasses this.
// A user with ANY listed role gets access.
export const MODULE_ACCESS: Record<string, PlatformRole[]> = {
  // Events + fighters are read-open to every platform role. Creation/edit is
  // gated separately (see ROLES_CAN_CREATE_EVENTS).
  events: [...PLATFORM_ROLES],
  fighters: [...PLATFORM_ROLES],
  gyms: ["promoter", "commission", "sanctioning_body", "coach", "gym_owner"],
  officials: ["promoter", "commission", "sanctioning_body", "official"],
  promotions: ["promoter", "commission", "sanctioning_body", "coach", "gym_owner", "fighter", "official"],
  medical: ["commission", "sanctioning_body", "official"],
  // rules module removed from top-level nav; still accessible via commission/SB detail
  rules: ["commission", "sanctioning_body"],
  registry: ["commission", "sanctioning_body", "promoter"],
  sb: ["sanctioning_body", "commission"],
  sponsors: ["promoter"],
  vendors: ["promoter"],
  payments: ["promoter", "commission", "sanctioning_body"],
};

// Roles allowed to create/edit events. Staff bypasses. "Admin" tier collapses
// into isStaff for now — add a distinct role here if that ever splits.
export const ROLES_CAN_CREATE_EVENTS: PlatformRole[] = ["promoter"];

export function canCreateEvents(
  userRoles: PlatformRole[],
  isStaff: boolean,
): boolean {
  if (isStaff) return true;
  return userRoles.some((r) => ROLES_CAN_CREATE_EVENTS.includes(r));
}

// Promoters can only edit events they created themselves. Staff/admin bypass.
export function canEditEvent(
  event: { created_by: string | null },
  user: { id: string; approvedRoles: PlatformRole[]; isStaff: boolean },
): boolean {
  if (user.isStaff) return true;
  if (!canCreateEvents(user.approvedRoles, user.isStaff)) return false;
  return event.created_by === user.id;
}

// Fighters/coaches without any operator-side role still land somewhere useful —
// their own profile page — but see none of the operator modules.

export function canAccessModule(
  slug: string,
  userRoles: PlatformRole[],
  isStaff: boolean,
): boolean {
  if (isStaff) return true;
  const allowed = MODULE_ACCESS[slug];
  if (!allowed) return true; // unmapped module → open to any signed-in user
  return userRoles.some((r) => allowed.includes(r));
}

export function hasAnyRole(userRoles: PlatformRole[], required: PlatformRole[]): boolean {
  return userRoles.some((r) => required.includes(r));
}
