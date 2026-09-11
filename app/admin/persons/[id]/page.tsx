import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, Gavel, Swords, UserCircle } from "lucide-react";

import {
  adminUpdateFighter,
  adminUpdateOfficial,
  adminUpdatePerson,
} from "./actions";
import { FormField } from "@/components/form-field";
import { PersonNoBadge } from "@/components/person-no-badge";
import { ToastedForm } from "@/components/forms/toasted-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createAdminClient } from "@/lib/supabase/server";
import { fmtPersonNo } from "@/lib/format-utils";
import { cmToFeetIn, cmToIn } from "@/lib/units";
import { OFFICIAL_ROLES, SPORTS, STANCES } from "@/lib/db/types";
import type { Fighter, Gym, Official, Person } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function AdminPersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: person } = await admin
    .from("persons")
    .select("*")
    .eq("id", id)
    .maybeSingle<Person>();
  if (!person) notFound();

  const [{ data: fighter }, { data: official }, { data: gyms }, mergedInto] =
    await Promise.all([
      admin
        .from("fighters")
        .select("*")
        .eq("person_id", id)
        .maybeSingle<Fighter>(),
      admin
        .from("officials")
        .select("*")
        .eq("person_id", id)
        .maybeSingle<Official>(),
      admin
        .from("gyms")
        .select("id, name, city, state")
        .order("name", { ascending: true }),
      person.merged_into_person_id
        ? admin
            .from("persons")
            .select("person_no")
            .eq("id", person.merged_into_person_id)
            .maybeSingle<{ person_no: number }>()
        : Promise.resolve({ data: null as { person_no: number } | null }),
    ]);

  const gymList = (gyms ?? []) as Pick<Gym, "id" | "name" | "city" | "state">[];
  const isMerged = Boolean(person.merged_into_person_id);
  const mergedIntoNo = mergedInto?.data?.person_no ?? null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          size="sm"
          variant="outline"
          render={
            <Link href="/admin/persons">
              <ArrowLeft className="h-3.5 w-3.5" />
              All persons
            </Link>
          }
        />
      </div>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {person.full_name}
          </h2>
          <PersonNoBadge no={person.person_no} />
          {isMerged && (
            <Badge variant="outline" className="gap-1">
              <Archive className="h-3 w-3" />
              Merged
              {mergedIntoNo != null && (
                <span className="ml-1">→ {fmtPersonNo(mergedIntoNo)}</span>
              )}
            </Badge>
          )}
          {person.auth_user_id && (
            <Badge variant="secondary" className="gap-1">
              <UserCircle className="h-3 w-3" />
              Has account
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Full editable view for staff. Every field on the person, plus any
          fighter or official record linked to this CP-number.
        </p>
      </header>

      {isMerged && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            <p className="font-medium">This person is a tombstone.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Their FKs point at{" "}
              {mergedIntoNo != null && (
                <Link
                  href={`/admin/persons?q=CP-${mergedIntoNo}`}
                  className="font-mono hover:underline"
                >
                  {fmtPersonNo(mergedIntoNo)}
                </Link>
              )}
              . Edits here won&rsquo;t reach live records — go to the target instead.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        <PersonEditCard person={person} />
        {fighter && (
          <FighterEditCard
            person={person}
            fighter={fighter}
            gymList={gymList}
          />
        )}
        {official && <OfficialEditCard person={person} official={official} />}
        {!fighter && !official && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This person has no fighter or official record linked. If they
                should have one, create the record from the module page and set
                its <code>person_id</code> to this row.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function PersonEditCard({ person }: { person: Person }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCircle className="h-4 w-4" />
          Person record
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ToastedForm
          action={adminUpdatePerson}
          successMessage="Person saved"
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="person_id" value={person.id} />
          <FormField label="Full name" htmlFor="pa_name" required className="sm:col-span-2">
            <Input
              id="pa_name"
              name="full_name"
              required
              defaultValue={person.full_name}
            />
          </FormField>
          <FormField label="Email" htmlFor="pa_email">
            <Input
              id="pa_email"
              name="email"
              type="email"
              defaultValue={person.email ?? ""}
            />
          </FormField>
          <FormField label="Phone" htmlFor="pa_phone">
            <Input
              id="pa_phone"
              name="phone"
              type="tel"
              defaultValue={person.phone ?? ""}
            />
          </FormField>
          <FormField label="Hometown" htmlFor="pa_home">
            <Input
              id="pa_home"
              name="hometown"
              defaultValue={person.hometown ?? ""}
            />
          </FormField>
          <FormField label="Nationality" htmlFor="pa_nat">
            <Input
              id="pa_nat"
              name="nationality"
              defaultValue={person.nationality ?? ""}
            />
          </FormField>
          <FormField label="Date of birth" htmlFor="pa_dob">
            <Input
              id="pa_dob"
              name="date_of_birth"
              type="date"
              defaultValue={person.date_of_birth ?? ""}
            />
          </FormField>
          <FormField label="Avatar URL" htmlFor="pa_avatar">
            <Input
              id="pa_avatar"
              name="avatar_url"
              type="url"
              defaultValue={person.avatar_url ?? ""}
            />
          </FormField>
          <FormField label="Notes" htmlFor="pa_notes" className="sm:col-span-2">
            <Textarea
              id="pa_notes"
              name="notes"
              rows={3}
              defaultValue={person.notes ?? ""}
            />
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm">
              Save person
            </Button>
          </div>
        </ToastedForm>
      </CardContent>
    </Card>
  );
}

function FighterEditCard({
  person,
  fighter,
  gymList,
}: {
  person: Person;
  fighter: Fighter;
  gymList: Pick<Gym, "id" | "name" | "city" | "state">[];
}) {
  const heightParts = cmToFeetIn(fighter.height_cm);
  const reachIn = cmToIn(fighter.reach_cm);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="h-4 w-4" />
          Fighter record
          <Badge variant="secondary" className="capitalize">
            {fighter.primary_sport}
          </Badge>
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            render={<Link href={`/fighters/${fighter.id}`}>View →</Link>}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ToastedForm
          action={adminUpdateFighter}
          successMessage="Fighter saved"
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="person_id" value={person.id} />
          <input type="hidden" name="fighter_id" value={fighter.id} />
          <FormField label="Full name" htmlFor="fa_name" required>
            <Input
              id="fa_name"
              name="full_name"
              required
              defaultValue={fighter.full_name}
            />
          </FormField>
          <FormField label="Nickname" htmlFor="fa_nick">
            <Input
              id="fa_nick"
              name="nickname"
              defaultValue={fighter.nickname ?? ""}
            />
          </FormField>
          <FormField label="Primary sport" htmlFor="fa_sport" required>
            <NativeSelect
              id="fa_sport"
              name="primary_sport"
              defaultValue={fighter.primary_sport}
              required
            >
              {SPORTS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Weight class" htmlFor="fa_wc">
            <Input
              id="fa_wc"
              name="weight_class"
              defaultValue={fighter.weight_class ?? ""}
            />
          </FormField>
          <FormField label="Gym" htmlFor="fa_gym" className="sm:col-span-2">
            <NativeSelect
              id="fa_gym"
              name="gym_id"
              defaultValue={fighter.gym_id ?? "__none__"}
            >
              <option value="__none__">— No gym</option>
              {gymList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.city ? ` — ${g.city}${g.state ? `, ${g.state}` : ""}` : ""}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Stance" htmlFor="fa_stance">
            <NativeSelect
              id="fa_stance"
              name="stance"
              defaultValue={fighter.stance ?? ""}
            >
              <option value="">—</option>
              {STANCES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Date of birth" htmlFor="fa_dob">
            <Input
              id="fa_dob"
              name="date_of_birth"
              type="date"
              defaultValue={fighter.date_of_birth ?? ""}
            />
          </FormField>
          <FormField label="Height (ft / in)" htmlFor="fa_ht">
            <div className="flex gap-2">
              <Input
                id="fa_ht"
                name="height_ft"
                type="number"
                min={3}
                max={8}
                placeholder="ft"
                defaultValue={heightParts?.feet ?? ""}
              />
              <Input
                name="height_in"
                type="number"
                min={0}
                max={11}
                placeholder="in"
                defaultValue={heightParts?.inches ?? ""}
              />
            </div>
          </FormField>
          <FormField label="Reach (in)" htmlFor="fa_reach">
            <Input
              id="fa_reach"
              name="reach_in"
              type="number"
              min={40}
              max={100}
              defaultValue={reachIn != null ? Math.round(reachIn) : ""}
            />
          </FormField>
          <FormField label="Walking weight (lbs)" htmlFor="fa_ww">
            <Input
              id="fa_ww"
              name="walking_weight_lbs"
              type="number"
              min={60}
              max={500}
              placeholder={
                fighter.walking_weight_lbs != null
                  ? String(fighter.walking_weight_lbs)
                  : "e.g. 172"
              }
            />
          </FormField>
          <FormField label="Hometown" htmlFor="fa_home">
            <Input
              id="fa_home"
              name="hometown"
              defaultValue={fighter.hometown ?? ""}
            />
          </FormField>
          <FormField label="Nationality" htmlFor="fa_nat">
            <Input
              id="fa_nat"
              name="nationality"
              defaultValue={fighter.nationality ?? ""}
            />
          </FormField>
          <FormField label="Contact email" htmlFor="fa_email">
            <Input
              id="fa_email"
              name="contact_email"
              type="email"
              defaultValue={fighter.contact_email ?? ""}
            />
          </FormField>
          <FormField label="Contact phone" htmlFor="fa_phone">
            <Input
              id="fa_phone"
              name="contact_phone"
              type="tel"
              defaultValue={fighter.contact_phone ?? ""}
            />
          </FormField>
          <FormField label="Photo URL" htmlFor="fa_photo" className="sm:col-span-2">
            <Input
              id="fa_photo"
              name="photo_url"
              type="url"
              defaultValue={fighter.photo_url ?? ""}
            />
          </FormField>
          <div className="sm:col-span-2 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pro record (W-L-D)
              </p>
              <div className="flex gap-2">
                <Input
                  name="pro_wins"
                  type="number"
                  min={0}
                  placeholder="W"
                  defaultValue={fighter.pro_wins ?? 0}
                />
                <Input
                  name="pro_losses"
                  type="number"
                  min={0}
                  placeholder="L"
                  defaultValue={fighter.pro_losses ?? 0}
                />
                <Input
                  name="pro_draws"
                  type="number"
                  min={0}
                  placeholder="D"
                  defaultValue={fighter.pro_draws ?? 0}
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Amateur record (W-L-D)
              </p>
              <div className="flex gap-2">
                <Input
                  name="am_wins"
                  type="number"
                  min={0}
                  placeholder="W"
                  defaultValue={fighter.am_wins ?? 0}
                />
                <Input
                  name="am_losses"
                  type="number"
                  min={0}
                  placeholder="L"
                  defaultValue={fighter.am_losses ?? 0}
                />
                <Input
                  name="am_draws"
                  type="number"
                  min={0}
                  placeholder="D"
                  defaultValue={fighter.am_draws ?? 0}
                />
              </div>
            </div>
          </div>
          <FormField label="Notes" htmlFor="fa_notes" className="sm:col-span-2">
            <Textarea
              id="fa_notes"
              name="notes"
              rows={2}
              defaultValue={fighter.notes ?? ""}
            />
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm">
              Save fighter
            </Button>
          </div>
        </ToastedForm>
      </CardContent>
    </Card>
  );
}

function OfficialEditCard({
  person,
  official,
}: {
  person: Person;
  official: Official;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4 w-4" />
          Officiating record
          <div className="flex flex-wrap gap-1">
            {official.roles.map((r) => (
              <Badge key={r} variant="secondary" className="capitalize">
                {r}
              </Badge>
            ))}
          </div>
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            render={<Link href={`/officials/${official.id}`}>View →</Link>}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ToastedForm
          action={adminUpdateOfficial}
          successMessage="Official saved"
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="person_id" value={person.id} />
          <input type="hidden" name="official_id" value={official.id} />
          <FormField label="Full name" htmlFor="oa_name" required className="sm:col-span-2">
            <Input
              id="oa_name"
              name="full_name"
              required
              defaultValue={official.full_name}
            />
          </FormField>
          <FormField
            label={`Roles (options: ${OFFICIAL_ROLES.join(", ")})`}
            htmlFor="oa_roles"
            className="sm:col-span-2"
            hint="Comma-separated"
          >
            <Input
              id="oa_roles"
              name="roles"
              defaultValue={official.roles.join(", ")}
            />
          </FormField>
          <FormField label="Home state" htmlFor="oa_state">
            <Input
              id="oa_state"
              name="home_state"
              defaultValue={official.home_state ?? ""}
              placeholder="e.g. FL"
            />
          </FormField>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={official.is_active}
                className="h-4 w-4"
              />
              Available for assignments
            </label>
          </div>
          <FormField label="Contact email" htmlFor="oa_email">
            <Input
              id="oa_email"
              name="contact_email"
              type="email"
              defaultValue={official.contact_email ?? ""}
            />
          </FormField>
          <FormField label="Contact phone" htmlFor="oa_phone">
            <Input
              id="oa_phone"
              name="contact_phone"
              type="tel"
              defaultValue={official.contact_phone ?? ""}
            />
          </FormField>
          <FormField label="Sports" htmlFor="oa_sports" className="sm:col-span-2" hint="Comma-separated">
            <Input
              id="oa_sports"
              name="sports"
              defaultValue={(official.sports ?? []).join(", ")}
            />
          </FormField>
          <FormField
            label="Certifications"
            htmlFor="oa_certs"
            className="sm:col-span-2"
            hint="Comma-separated"
          >
            <Textarea
              id="oa_certs"
              name="certifications"
              rows={2}
              defaultValue={(official.certifications ?? []).join(", ")}
            />
          </FormField>
          <FormField label="Photo URL" htmlFor="oa_photo" className="sm:col-span-2">
            <Input
              id="oa_photo"
              name="photo_url"
              type="url"
              defaultValue={official.photo_url ?? ""}
            />
          </FormField>
          <FormField label="Notes" htmlFor="oa_notes" className="sm:col-span-2">
            <Textarea
              id="oa_notes"
              name="notes"
              rows={2}
              defaultValue={official.notes ?? ""}
            />
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm">
              Save official
            </Button>
          </div>
        </ToastedForm>
      </CardContent>
    </Card>
  );
}
