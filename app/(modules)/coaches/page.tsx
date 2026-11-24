import Link from "next/link";
import { Pencil, X } from "lucide-react";

import { removeCoach } from "./actions";
import { AddCoachForm } from "./_components/add-coach-form";
import { db } from "@/lib/db/client";
import { getSessionUser, requireModuleAccess } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { GymLogo } from "@/components/gym-logo";
import { COACH_ROLES, COACH_ROLE_LABELS, type Coach, type Gym } from "@/lib/db/types";

type Search = { q?: string; role?: string };
type CoachRow = Coach & {
  gym: Pick<Gym, "id" | "name" | "logo_url"> | null;
  // The shared person record, and the fighter profile on it if they also fight.
  person: { fighters: { id: string }[] } | null;
};

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireModuleAccess("coaches");
  const { q = "", role = "" } = await searchParams;
  const supabase = db();

  const [session, coachRes, { data: gyms }] = await Promise.all([
    getSessionUser(),
    supabase
      .from("coaches")
      .select("*, gym:gyms(id, name, logo_url), person:persons(fighters(id))")
      .order("full_name"),
    supabase.from("gyms").select("id, name").order("name"),
  ]);
  const isStaff = session?.isStaff === true;
  const gymList = (gyms ?? []) as Pick<Gym, "id" | "name">[];

  if (coachRes.error) {
    console.error("[coaches]", coachRes.error.code, coachRes.error.message);
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Coaches aren&apos;t available yet. The latest database migration (
        <code>0051_gym_owners_as_people.sql</code>) needs to be applied.
      </div>
    );
  }

  const all = (coachRes.data ?? []) as unknown as CoachRow[];
  const needle = q.trim().toLowerCase();
  const list = all.filter(
    (c) =>
      (!role || (role === "owner" ? c.is_owner : c.role === role)) &&
      (!needle ||
        c.full_name.toLowerCase().includes(needle) ||
        (c.gym?.name ?? "").toLowerCase().includes(needle)),
  );

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Coaches &amp; owners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Head coaches, junior coaches and gym owners, and the gym each one belongs to.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search name or gym"
              className="max-w-xs"
              aria-label="Search name or gym"
            />
            <NativeSelect name="role" defaultValue={role} className="w-40" aria-label="Role">
              <option value="">Everyone</option>
              {COACH_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}s
                </option>
              ))}
              <option value="owner">Owners</option>
            </NativeSelect>
            <Button type="submit" size="sm">
              Filter
            </Button>
            {(q || role) && (
              <Button size="sm" variant="ghost" render={<Link href="/coaches">Reset</Link>} />
            )}
          </form>

          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {all.length === 0 ? "No coaches or owners yet." : "No one matches that search."}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border/70">
              {list.map((c) => {
                const fighterId = c.person?.fighters[0]?.id ?? null;
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
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
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {c.gym ? (
                          <Link
                            href={`/gyms/${c.gym.id}`}
                            className="inline-flex items-center gap-1.5 align-middle hover:underline"
                          >
                            {c.gym.logo_url && (
                              <GymLogo src={c.gym.logo_url} name={c.gym.name} size={16} />
                            )}
                            {c.gym.name}
                          </Link>
                        ) : (
                          "No gym"
                        )}
                        {c.contact_email && ` · ${c.contact_email}`}
                        {c.contact_phone && ` · ${c.contact_phone}`}
                      </div>
                    </div>
                    {isStaff && (
                      <div className="flex items-center gap-1">
                        {c.gym && (
                          <Button
                            size="sm"
                            variant="outline"
                            render={
                              <Link href={`/gyms/${c.gym.id}/edit#people`}>
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Link>
                            }
                          />
                        )}
                        <ToastedForm action={removeCoach} successMessage="Removed">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="gym_id" value={c.gym_id ?? ""} />
                          <Button
                            type="submit"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove ${c.full_name}`}
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </ToastedForm>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isStaff && (
          <Card collapsible={false} className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Add a coach or owner</CardTitle>
            </CardHeader>
            <CardContent>
              <AddCoachForm gyms={gymList} />
              <p className="mt-3 text-xs text-muted-foreground">
                To edit someone, or to mark them as also being a fighter, use Edit to open their
                gym&apos;s page.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
