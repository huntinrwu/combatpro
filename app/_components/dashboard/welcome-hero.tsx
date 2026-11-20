import Link from "next/link";
import { CalendarDays, ClipboardList, Plus, Users } from "lucide-react";

// Top of the dashboard: who you are, what's coming up, and the two or three
// things people most often come here to do.
export function WelcomeHero({
  name,
  roles,
  stats,
  canCreateEvent,
  canAddFighter,
}: {
  name: string;
  roles: string[];
  stats: { upcomingEvents: number; fighters: number; pendingSignups: number | null };
  canCreateEvent: boolean;
  canAddFighter: boolean;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const tiles = [
    { label: "Upcoming events", value: stats.upcomingEvents, Icon: CalendarDays, href: "/events" },
    { label: "Fighters", value: stats.fighters, Icon: Users, href: "/fighters" },
    ...(stats.pendingSignups != null
      ? [
          {
            label: "Sign-ups waiting",
            value: stats.pendingSignups,
            Icon: ClipboardList,
            href: "/events",
          },
        ]
      : []),
  ];

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl bg-neutral-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 15% 20%, rgba(220,38,38,0.35), transparent 50%), radial-gradient(ellipse at 85% 80%, rgba(30,64,175,0.4), transparent 55%)",
        }}
      />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-brand">{today}</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {name}
          </h1>
          {roles.length > 0 && (
            <p className="mt-2 text-sm text-white/60">{roles.join(" · ")}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {canCreateEvent && (
              <Link
                href="/events/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                New event
              </Link>
            )}
            {canAddFighter && (
              <Link
                href="/fighters/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3.5 text-sm font-medium transition-colors hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                Add fighter
              </Link>
            )}
            <Link
              href="/events"
              className="inline-flex h-9 items-center rounded-lg border border-white/20 bg-white/5 px-3.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              All events
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {tiles.map(({ label, value, Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="min-w-24 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10 sm:min-w-32"
            >
              <Icon className="h-4 w-4 text-brand" />
              <div className="mt-2 font-heading text-2xl font-semibold tabular-nums">{value}</div>
              <div className="text-[11px] text-white/60">{label}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
