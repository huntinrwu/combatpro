import Link from "next/link";
import { Building2, ClipboardList, Gavel, Megaphone, Swords, UserCircle } from "lucide-react";

import { db } from "@/lib/db/client";
import { cn } from "@/lib/utils";
import { COACH_ROLE_LABELS, type CoachRole } from "@/lib/db/types";

type Tab = { key: string; href: string; label: string; Icon: typeof Swords };

// One person can be a fighter, a coach, a gym owner, an official and a
// promoter at once. This strip sits at the top of each of their pages and
// jumps between them. It shows nothing for someone with a single page.
//
// `current` names the page being viewed: "fighter:<id>", "coach:<id>" or
// "official:<id>".
export async function PersonRoleNav({
  personId,
  current,
  showPersonRecord = false,
}: {
  personId: string | null | undefined;
  current: string;
  // Staff also get a link to the underlying person record.
  showPersonRecord?: boolean;
}) {
  if (!personId) return null;
  const supabase = db();
  const [{ data: fighters }, { data: coaches }, { data: officials }, { data: promotions }] =
    await Promise.all([
      supabase.from("fighters").select("id").eq("person_id", personId),
      supabase
        .from("coaches")
        .select("id, role, is_owner, gym:gyms(id, name)")
        .eq("person_id", personId),
      supabase.from("officials").select("id").eq("person_id", personId),
      supabase.from("promotions").select("id, name").eq("contact_person_id", personId),
    ]);

  const tabs: Tab[] = [];
  for (const f of (fighters ?? []) as { id: string }[]) {
    tabs.push({ key: `fighter:${f.id}`, href: `/fighters/${f.id}`, label: "Fighter", Icon: Swords });
  }
  for (const c of (coaches ?? []) as unknown as {
    id: string;
    role: CoachRole | null;
    is_owner: boolean;
    gym: { id: string; name: string } | null;
  }[]) {
    tabs.push({
      key: `coach:${c.id}`,
      href: `/coaches/${c.id}`,
      // An owner who doesn't coach still has this page as their profile.
      label: c.role ? COACH_ROLE_LABELS[c.role] : "Owner",
      Icon: ClipboardList,
    });
    if (c.is_owner && c.gym) {
      tabs.push({
        key: `gym:${c.gym.id}`,
        href: `/gyms/${c.gym.id}`,
        label: `Owner · ${c.gym.name}`,
        Icon: Building2,
      });
    }
  }
  for (const o of (officials ?? []) as { id: string }[]) {
    tabs.push({ key: `official:${o.id}`, href: `/officials/${o.id}`, label: "Official", Icon: Gavel });
  }
  for (const p of (promotions ?? []) as { id: string; name: string }[]) {
    tabs.push({
      key: `promotion:${p.id}`,
      href: `/promotions/${p.id}`,
      label: `Promoter · ${p.name}`,
      Icon: Megaphone,
    });
  }

  // Nothing to switch between.
  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label="This person's pages"
      className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-1"
    >
      {tabs.map(({ key, href, label, Icon }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-foreground/10"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
      {showPersonRecord && (
        <Link
          href={`/admin/persons/${personId}`}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground"
        >
          <UserCircle className="h-3.5 w-3.5" />
          Person record
        </Link>
      )}
    </nav>
  );
}
