import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { db } from "@/lib/db/client";
import { getSessionUser, requireModuleAccess } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailRow } from "@/components/detail-row";
import { GymLogo } from "@/components/gym-logo";
import { PersonNoBadge } from "@/components/person-no-badge";
import { PersonRoleNav } from "@/components/person-role-nav";
import { COACH_ROLE_LABELS, type Coach, type Fighter, type Gym } from "@/lib/db/types";

type CoachProfile = Coach & {
  gym: Pick<Gym, "id" | "name" | "city" | "state" | "logo_url"> | null;
  // The shared person record, with the fighter profile on it if they also fight.
  person: {
    person_no: number;
    fighters: Pick<
      Fighter,
      | "id"
      | "primary_sport"
      | "weight_class"
      | "pro_wins"
      | "pro_losses"
      | "pro_draws"
      | "am_wins"
      | "am_losses"
      | "am_draws"
    >[];
  } | null;
};

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("coaches");
  const { id } = await params;

  const [session, { data }] = await Promise.all([
    getSessionUser(),
    db()
      .from("coaches")
      .select(
        "*, gym:gyms(id, name, city, state, logo_url), person:persons(person_no, fighters(id, primary_sport, weight_class, pro_wins, pro_losses, pro_draws, am_wins, am_losses, am_draws))",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!data) notFound();
  const coach = data as unknown as CoachProfile;
  const fighter = coach.person?.fighters[0] ?? null;

  // Everyone else at the same gym, so the profile leads somewhere.
  const { data: others } = coach.gym_id
    ? await db()
        .from("coaches")
        .select("id, full_name, role, is_owner")
        .eq("gym_id", coach.gym_id)
        .neq("id", coach.id)
        .order("full_name")
    : { data: [] };
  const colleagues = (others ?? []) as Pick<Coach, "id" | "full_name" | "role" | "is_owner">[];

  return (
    <>
      <PersonRoleNav
        personId={coach.person_id}
        current={`coach:${coach.id}`}
        showPersonRecord={session?.isStaff}
      />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-1 font-heading text-3xl font-semibold tracking-tight">
              {coach.full_name}
            </h1>
            {coach.person?.person_no != null && <PersonNoBadge no={coach.person.person_no} />}
            {coach.role && (
              <Badge variant="secondary">{COACH_ROLE_LABELS[coach.role]}</Badge>
            )}
            {coach.is_owner && <Badge variant="outline">Owner</Badge>}
            {fighter && <Badge variant="outline">Fighter</Badge>}
          </div>
          {coach.gym && (
            <Link
              href={`/gyms/${coach.gym.id}`}
              className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <GymLogo src={coach.gym.logo_url} name={coach.gym.name} size={24} />
              {coach.gym.name}
              {(coach.gym.city || coach.gym.state) &&
                ` · ${[coach.gym.city, coach.gym.state].filter(Boolean).join(", ")}`}
            </Link>
          )}
        </div>
        {session?.isStaff && coach.gym && (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link href={`/gyms/${coach.gym.id}/edit#people`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            }
          />
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card collapsible={false}>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Role"
              value={
                [coach.role ? COACH_ROLE_LABELS[coach.role] : null, coach.is_owner ? "Owner" : null]
                  .filter(Boolean)
                  .join(" & ") || null
              }
            />
            <DetailRow
              label="Gym"
              value={
                coach.gym ? (
                  <Link href={`/gyms/${coach.gym.id}`} className="hover:underline">
                    {coach.gym.name}
                  </Link>
                ) : null
              }
            />
            <DetailRow
              label="Email"
              value={
                coach.contact_email ? (
                  <a href={`mailto:${coach.contact_email}`} className="hover:underline">
                    {coach.contact_email}
                  </a>
                ) : null
              }
            />
            <DetailRow label="Phone" value={coach.contact_phone} />
            {coach.notes && <DetailRow label="Notes" value={coach.notes} />}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {fighter && (
            <Card collapsible={false}>
              <CardHeader>
                <CardTitle className="text-base">Also a fighter</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailRow
                  label="Sport"
                  value={<span className="capitalize">{fighter.primary_sport}</span>}
                />
                <DetailRow label="Weight class" value={fighter.weight_class} />
                <DetailRow
                  label="Record"
                  value={
                    <span className="font-mono text-xs">
                      Pro {fighter.pro_wins}-{fighter.pro_losses}-{fighter.pro_draws} · Am{" "}
                      {fighter.am_wins}-{fighter.am_losses}-{fighter.am_draws}
                    </span>
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  render={<Link href={`/fighters/${fighter.id}`}>Open fighter profile</Link>}
                />
              </CardContent>
            </Card>
          )}

          {colleagues.length > 0 && (
            <Card collapsible={false}>
              <CardHeader>
                <CardTitle className="text-base">Also at {coach.gym?.name ?? "this gym"}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/60">
                  {colleagues.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-1.5 py-1.5 text-sm">
                      <Link href={`/coaches/${c.id}`} className="mr-1 font-medium hover:underline">
                        {c.full_name}
                      </Link>
                      {c.role && <Badge variant="outline">{COACH_ROLE_LABELS[c.role]}</Badge>}
                      {c.is_owner && <Badge variant="outline">Owner</Badge>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
