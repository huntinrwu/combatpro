import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ClipboardList, Pencil, UserCog, Users } from "lucide-react";

import { db } from "@/lib/db/client";
import { fmtDateShortWithDay as fmtEventDate } from "@/lib/format-utils";
import { getSessionUser, requireModuleAccess } from "@/lib/auth/session";
import { eventOwnerScope } from "@/lib/auth/event-scope";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/detail-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COACH_ROLE_LABELS, type Bout, type Coach, type EventRow, type Fighter, type Gym } from "@/lib/db/types";
import { GymLogo } from "@/components/gym-logo";

type UpcomingRow = {
  bout_id: string;
  event: Pick<EventRow, "id" | "name" | "event_date" | "venue">;
  bout_order: number | null;
  fighter_name: string;
  corner: "red" | "blue";
};

export default async function GymDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireModuleAccess("gyms");
  const ownerScope = eventOwnerScope(viewer);
  const { id } = await params;
  const supabase = db();

  const [session, { data: gym }, { data: roster }, { data: coachRows }] = await Promise.all([
    getSessionUser(),
    supabase.from("gyms").select("*").eq("id", id).maybeSingle<Gym>(),
    supabase
      .from("fighters")
      .select("id, full_name, nickname, primary_sport, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws, weight_class")
      .eq("gym_id", id)
      .order("full_name"),
    supabase
      .from("coaches")
      .select("*, person:persons(fighters(id))")
      .eq("gym_id", id)
      .order("full_name"),
  ]);

  if (!gym) notFound();

  // Head coaches first, then junior coaches, then owners who don't coach.
  const rank = (c: Coach) => (c.role === "head_coach" ? 0 : c.role === "jr_coach" ? 1 : 2);
  const coaches = (
    (coachRows ?? []) as unknown as (Coach & { person: { fighters: { id: string }[] } | null })[]
  ).sort((a, b) => rank(a) - rank(b));
  const owners = coaches.filter((c) => c.is_owner).map((c) => c.full_name);
  const headCoaches = coaches.filter((c) => c.role === "head_coach").map((c) => c.full_name);

  const rosterList = (roster ?? []) as Pick<
    Fighter,
    "id" | "full_name" | "nickname" | "primary_sport" | "pro_wins" | "pro_losses" | "pro_draws" | "am_wins" | "am_losses" | "am_draws" | "weight_class"
  >[];

  // Upcoming bouts: any registered fighter in this gym, either corner, event_date >= today.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming: UpcomingRow[] = [];
  const rosterIds = rosterList.map((f) => f.id);
  if (rosterIds.length) {
    // Inner-join the event so past events are filtered out in SQL. bouts and
    // events are linked twice (bouts.event_id + events.current_bout_id), so the
    // embed has to name the FK.
    const boutsQuery = supabase
      .from("bouts")
      .select(
        "id, bout_order, red_corner_fighter_id, blue_corner_fighter_id, event:events!bouts_event_id_fkey!inner(id, name, event_date, venue)",
      )
      .gte("event.event_date", today);
    const { data: bouts } = await (
      ownerScope ? boutsQuery.eq("event.created_by", ownerScope) : boutsQuery
    ).or(
        `red_corner_fighter_id.in.(${rosterIds.join(",")}),blue_corner_fighter_id.in.(${rosterIds.join(",")})`,
      );
    const boutList = (bouts ?? []) as unknown as (Pick<
      Bout,
      "id" | "bout_order" | "red_corner_fighter_id" | "blue_corner_fighter_id"
    > & { event: UpcomingRow["event"] })[];
    const rosterMap = new Map(rosterList.map((f) => [f.id, f.full_name]));
    for (const b of boutList) {
      if (b.red_corner_fighter_id && rosterMap.has(b.red_corner_fighter_id)) {
        upcoming.push({
          bout_id: b.id,
          event: b.event,
          bout_order: b.bout_order,
          fighter_name: rosterMap.get(b.red_corner_fighter_id)!,
          corner: "red",
        });
      }
      if (b.blue_corner_fighter_id && rosterMap.has(b.blue_corner_fighter_id)) {
        upcoming.push({
          bout_id: b.id,
          event: b.event,
          bout_order: b.bout_order,
          fighter_name: rosterMap.get(b.blue_corner_fighter_id)!,
          corner: "blue",
        });
      }
    }
    upcoming.sort((a, b) => a.event.event_date.localeCompare(b.event.event_date));
  }

  return (
    <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          {gym.logo_url && <GymLogo src={gym.logo_url} name={gym.name} size={64} className="rounded-lg" />}
          <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{gym.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {owners.length > 0 && <span>Owned by {owners.join(", ")}</span>}
            {owners.length > 0 && <span>·</span>}
            {headCoaches.length > 0 && (
              <span>
                Head coach{headCoaches.length === 1 ? "" : "es"} {headCoaches.join(", ")}
              </span>
            )}
            {headCoaches.length > 0 && (gym.city || gym.state) && <span>·</span>}
            {(gym.city || gym.state) && (
              <span>{[gym.city, gym.state].filter(Boolean).join(", ")}</span>
            )}
            <span>·</span>
            <span>{rosterList.length} on roster</span>
            <span>·</span>
            <span>{upcoming.length} upcoming bout{upcoming.length === 1 ? "" : "s"}</span>
          </div>
          </div>
        </div>
        {session?.isStaff && (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link href={`/gyms/${gym.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            }
          />
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="City" value={gym.city} />
            <DetailRow label="State" value={gym.state} />
            <DetailRow label="Country" value={gym.country} />
            <DetailRow
              label="Website"
              value={
                gym.website ? (
                  <a
                    href={gym.website}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {gym.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact &amp; notes</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Email"
              value={
                gym.contact_email ? (
                  <a href={`mailto:${gym.contact_email}`} className="hover:underline">
                    {gym.contact_email}
                  </a>
                ) : null
              }
            />
            <DetailRow label="Phone" value={gym.contact_phone} />
            <DetailRow label="Owner(s)" value={owners.join(", ") || null} />
            <DetailRow
              label="Notes"
              value={
                gym.notes ? (
                  <span className="whitespace-pre-wrap text-left">{gym.notes}</span>
                ) : null
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4" />
            Coaches &amp; owners ({coaches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coaches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coaches or owners listed yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border/70">
              {coaches.map((c) => {
                const fighterId = c.person?.fighters[0]?.id ?? null;
                return (
                  <li key={c.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <Link href={`/coaches/${c.id}`} className="mr-0.5 hover:underline">
                        {c.full_name}
                      </Link>
                      {c.role && (
                        <Badge variant={c.role === "head_coach" ? "secondary" : "outline"}>
                          {COACH_ROLE_LABELS[c.role]}
                        </Badge>
                      )}
                      {c.is_owner && <Badge variant="outline">Owner</Badge>}
                      {fighterId && (
                        <Link href={`/fighters/${fighterId}`}>
                          <Badge variant="outline" className="hover:bg-muted">
                            Fighter
                          </Badge>
                        </Link>
                      )}
                    </div>
                    {(c.contact_email || c.contact_phone) && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[c.contact_email, c.contact_phone].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {session?.isStaff && (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link href={`/gyms/${gym.id}/edit#people`} className="underline hover:text-foreground">
                Add, edit or remove coaches and owners
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Roster ({rosterList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rosterList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fighters registered to this gym yet. Assign one from any fighter&apos;s detail page.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Sport</th>
                    <th className="px-3 py-2 font-medium">Weight</th>
                    <th className="px-3 py-2 font-medium">Pro</th>
                    <th className="px-3 py-2 font-medium">Am</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rosterList.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/fighters/${f.id}`} className="font-medium hover:underline">
                          {f.full_name}
                        </Link>
                        {f.nickname && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            &quot;{f.nickname}&quot;
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="capitalize">
                          {f.primary_sport}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {f.weight_class || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {f.pro_wins}-{f.pro_losses}-{f.pro_draws}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {f.am_wins}-{f.am_losses}-{f.am_draws}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Upcoming bouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming bouts for anyone on this roster.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {upcoming.map((u) => (
                <li
                  key={`${u.bout_id}-${u.corner}`}
                  className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-muted/40"
                >
                  <Badge
                    variant="outline"
                    className={
                      u.corner === "red"
                        ? "border-red-500/40 text-red-700 dark:text-red-300"
                        : "border-blue-500/40 text-blue-700 dark:text-blue-300"
                    }
                  >
                    {u.corner === "red" ? "RED" : "BLUE"}
                  </Badge>
                  <Link
                    href={`/events/${u.event.id}/bouts/${u.bout_id}`}
                    className="flex-1 hover:underline"
                  >
                    <div className="font-medium">
                      {u.fighter_name} — {u.event.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <CalendarClock className="inline h-3 w-3" />{" "}
                      {fmtEventDate(u.event.event_date)}
                      {u.event.venue && <> · {u.event.venue}</>}
                      {u.bout_order != null && <> · Bout {u.bout_order}</>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
