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
  description: string;
  Icon: LucideIcon;
  section: ModuleSectionKey;
  pinned?: boolean;
};

export const MODULES: Module[] = [
  // Operations — the day-to-day surfaces promoters live in
  {
    slug: "events",
    title: "Events",
    description: "Cards, bouts, weigh-ins, bout sheets, per-sport rules.",
    Icon: CalendarDays,
    section: "operations",
    pinned: true,
  },
  {
    slug: "fighters",
    title: "Fighters",
    description: "Registry — profiles, weight class, record, contact.",
    Icon: Users,
    section: "operations",
    pinned: true,
  },
  {
    slug: "gyms",
    title: "Gyms",
    description: "Camps + coaches. Fighter rosters + upcoming bouts per gym.",
    Icon: Dumbbell,
    section: "operations",
  },
  {
    slug: "officials",
    title: "Officials",
    description: "Judges, referees, timekeepers — assign per bout.",
    Icon: Gavel,
    section: "operations",
  },
  {
    slug: "promotions",
    title: "Promotions",
    description: "Registry of promoters + brands. Events, roster, and results per house.",
    Icon: Megaphone,
    section: "operations",
    pinned: true,
  },

  // Regulatory — sanction paperwork, medicals, rulesets
  {
    slug: "medical",
    title: "Medical",
    description: "Clearances, licenses, waivers, doctor sign-off.",
    Icon: Stethoscope,
    section: "regulatory",
  },
  {
    slug: "registry",
    title: "Commissions & Bodies",
    description: "State commissions + sanctioning body registry. Each has its own rulesets.",
    Icon: Landmark,
    section: "regulatory",
  },
  {
    slug: "sb",
    title: "Sanctioning body view",
    description: "Tenant dashboard — sanctioned events, docs queue, fighter pool.",
    Icon: ShieldCheck,
    section: "regulatory",
    pinned: true,
  },

  // Business — revenue, payouts, sponsors
  {
    slug: "sponsors",
    title: "Sponsors",
    description: "Sponsor registry + per-event slots — feeds the revenue ledger.",
    Icon: Handshake,
    section: "business",
    pinned: true,
  },
  {
    slug: "vendors",
    title: "Vendors",
    description: "Registry of who you pay — venue, security, catering, insurance, etc.",
    Icon: Store,
    section: "business",
  },
  {
    slug: "payments",
    title: "Payments",
    description: "Purse tracking, payouts, sanction fees, Stripe subs.",
    Icon: Wallet,
    section: "business",
  },
];

export const MODULE_SECTIONS: {
  key: ModuleSectionKey;
  title: string;
  description: string;
}[] = [
  {
    key: "operations",
    title: "Operations",
    description: "Day-to-day promoter workflow — cards, fighters, gyms, officials.",
  },
  {
    key: "regulatory",
    title: "Regulatory",
    description: "Medicals, rules, sanctioning bodies, commission-facing surfaces.",
  },
  {
    key: "business",
    title: "Business",
    description: "Revenue side — sponsor deals and fighter payouts.",
  },
];

export function modulesBySection(): Record<ModuleSectionKey, Module[]> {
  const out: Record<ModuleSectionKey, Module[]> = {
    operations: [],
    regulatory: [],
    business: [],
  };
  for (const m of MODULES) out[m.section].push(m);
  return out;
}

export const PINNED_MODULES = MODULES.filter((m) => m.pinned);

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
