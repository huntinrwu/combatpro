import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Dumbbell,
  Gavel,
  Handshake,
  Landmark,
  Megaphone,
  ShieldCheck,
  Stethoscope,
  Store,
  Users,
  Wallet,
} from "lucide-react";

import { MODULE_ACCESS, type PlatformRole } from "./auth/roles";

export type ModuleSectionKey = "operations" | "regulatory" | "business";

export type Module = {
  slug: string;
  title: string;
  Icon: LucideIcon;
  section: ModuleSectionKey;
};

export const MODULES: Module[] = [
  // Operations — the day-to-day surfaces promoters live in
  {
    slug: "events",
    title: "Events",
    Icon: CalendarDays,
    section: "operations",
  },
  {
    slug: "fighters",
    title: "Fighters",
    Icon: Users,
    section: "operations",
  },
  {
    slug: "gyms",
    title: "Gyms",
    Icon: Dumbbell,
    section: "operations",
  },
  {
    slug: "officials",
    title: "Officials",
    Icon: Gavel,
    section: "operations",
  },
  {
    slug: "promotions",
    title: "Promotions",
    Icon: Megaphone,
    section: "operations",
  },

  // Regulatory — sanction paperwork, medicals, rulesets
  {
    slug: "medical",
    title: "Medical",
    Icon: Stethoscope,
    section: "regulatory",
  },
  {
    slug: "registry",
    title: "Commissions & Bodies",
    Icon: Landmark,
    section: "regulatory",
  },
  {
    slug: "sb",
    title: "Sanctioning body view",
    Icon: ShieldCheck,
    section: "regulatory",
  },

  // Business — revenue, payouts, sponsors
  {
    slug: "sponsors",
    title: "Sponsors",
    Icon: Handshake,
    section: "business",
  },
  {
    slug: "vendors",
    title: "Vendors",
    Icon: Store,
    section: "business",
  },
  {
    slug: "payments",
    title: "Payments",
    Icon: Wallet,
    section: "business",
  },
];

export const MODULE_SECTIONS: {
  key: ModuleSectionKey;
  title: string;
}[] = [
  {
    key: "operations",
    title: "Operations",
  },
  {
    key: "regulatory",
    title: "Regulatory",
  },
  {
    key: "business",
    title: "Business",
  },
];

// Bucket a (possibly filtered) module list by section, preserving MODULES
// order within each bucket. Shared by the sidebar and dashboard strip.
export function groupModulesBySection(
  modules: readonly Module[],
): Record<ModuleSectionKey, Module[]> {
  const out: Record<ModuleSectionKey, Module[]> = {
    operations: [],
    regulatory: [],
    business: [],
  };
  for (const m of modules) out[m.section].push(m);
  return out;
}

// Filter the module list to just what a user with these roles can access.
// Staff sees everything.
export function visibleModules(
  userRoles: PlatformRole[],
  isStaff: boolean,
): Module[] {
  if (isStaff) return MODULES;
  return MODULES.filter((m) => {
    const allowed = MODULE_ACCESS[m.slug];
    if (!allowed) return true;
    return userRoles.some((r) => allowed.includes(r));
  });
}
