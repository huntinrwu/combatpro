import { redirect } from "next/navigation";
import { Gavel, Swords, UserCircle } from "lucide-react";

import { updateMyFighter, updateMyOfficial, updateMyPerson } from "./actions";
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
import { getSessionUser } from "@/lib/auth/session";
import { cmToFeetIn, cmToIn } from "@/lib/units";
import type {
  Fighter,
  Gym,
  Official,
  OfficialRole,
  Person,
} from "@/lib/db/types";
import { SPORTS, STANCES } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.personId) {
    return (
      <>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          My profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn&rsquo;t linked to a person yet. Contact staff to have
          your CP-number assigned.
        </p>
      </>
    );
  }

  const admin = createAdminClient();
  const [
    { data: person },
    { data: fighter },
    { data: official },
    { data: gyms },
  ] = await Promise.all([
    admin
      .from("persons")
      .select("*")
      .eq("id", user.personId)
      .maybeSingle<Person>(),
    admin
      .from("fighters")
      .select("*")
      .eq("person_id", user.personId)
      .maybeSingle<Fighter>(),
    admin
      .from("officials")
      .select("*")
      .eq("person_id", user.personId)
      .maybeSingle<Official>(),
    admin
      .from("gyms")
      .select("id, name, city, state")
      .order("name", { ascending: true }),
  ]);

  const gymList = (gyms ?? []) as Pick<Gym, "id" | "name" | "city" | "state">[];

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            My profile
          </h1>
          {person?.person_no != null && (
            <PersonNoBadge no={person.person_no} />
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything the platform knows about you. Update your personal info
          here, plus the fighter or officiating profile linked to your account.
        </p>
      </header>

      <div className="grid gap-6">
        <PersonCard person={person} />
        {fighter && <FighterCard fighter={fighter} gymList={gymList} />}
        {official && <OfficialCard official={official} />}
        {!fighter && !official && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You don&rsquo;t have a fighter or official record linked to your
                account yet. Request a role from an admin, or ask staff to link
                an existing record to your CP-number.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function PersonCard({ person }: { person: Person | null }) {
  if (!person) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCircle className="h-4 w-4" />
          Personal info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ToastedForm
          action={updateMyPerson}
          successMessage="Personal info saved"
          className="grid gap-3 sm:grid-cols-2"
        >
          <FormField label="Full name" htmlFor="p_name" required className="sm:col-span-2">
            <Input
              id="p_name"
              name="full_name"
              required
              defaultValue={person.full_name}
            />
          </FormField>
          <FormField label="Email" htmlFor="p_email">
            <Input
              id="p_email"
              name="email"
              type="email"
              defaultValue={person.email ?? ""}
            />
          </FormField>
          <FormField label="Phone" htmlFor="p_phone">
            <Input
              id="p_phone"
              name="phone"
              type="tel"
              defaultValue={person.phone ?? ""}
            />
          </FormField>
          <FormField label="Hometown" htmlFor="p_hometown">
            <Input
              id="p_hometown"
              name="hometown"
              defaultValue={person.hometown ?? ""}
            />
          </FormField>
          <FormField label="Nationality" htmlFor="p_nationality">
            <Input
              id="p_nationality"
              name="nationality"
              defaultValue={person.nationality ?? ""}
            />
          </FormField>
          <FormField label="Date of birth" htmlFor="p_dob">
            <Input
              id="p_dob"
              name="date_of_birth"
              type="date"
              defaultValue={person.date_of_birth ?? ""}
            />
          </FormField>
          <FormField label="Avatar URL" htmlFor="p_avatar">
            <Input
              id="p_avatar"
              name="avatar_url"
              type="url"
              defaultValue={person.avatar_url ?? ""}
            />
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm">
              Save personal info
            </Button>
          </div>
        </ToastedForm>
      </CardContent>
    </Card>
  );
}

function FighterCard({
  fighter,
  gymList,
}: {
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
          Fighter profile
          <Badge variant="secondary" className="capitalize">
            {fighter.primary_sport}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ToastedForm
          action={updateMyFighter}
          successMessage="Fighter info saved"
          className="grid gap-3 sm:grid-cols-2"
        >
          <FormField label="Nickname" htmlFor="f_nickname">
            <Input
              id="f_nickname"
              name="nickname"
              defaultValue={fighter.nickname ?? ""}
            />
          </FormField>
          <FormField label="Primary sport" htmlFor="f_sport">
            <NativeSelect
              id="f_sport"
              name="primary_sport"
              defaultValue={fighter.primary_sport}
            >
              {SPORTS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Gym" htmlFor="f_gym" className="sm:col-span-2">
            <NativeSelect
              id="f_gym"
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
          <FormField label="Weight class" htmlFor="f_wc">
            <Input
              id="f_wc"
              name="weight_class"
              defaultValue={fighter.weight_class ?? ""}
            />
          </FormField>
          <FormField label="Stance" htmlFor="f_stance">
            <NativeSelect
              id="f_stance"
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
          <FormField label="Height (ft / in)" htmlFor="f_ht">
            <div className="flex gap-2">
              <Input
                id="f_ht"
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
          <FormField label="Reach (in)" htmlFor="f_reach">
            <Input
              id="f_reach"
              name="reach_in"
              type="number"
              min={40}
              max={100}
              defaultValue={reachIn != null ? Math.round(reachIn) : ""}
            />
          </FormField>
          <FormField label="Walking weight (lbs)" htmlFor="f_ww">
            <Input
              id="f_ww"
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
          <FormField label="Contact email" htmlFor="f_email">
            <Input
              id="f_email"
              name="contact_email"
              type="email"
              defaultValue={fighter.contact_email ?? ""}
            />
          </FormField>
          <FormField label="Contact phone" htmlFor="f_phone">
            <Input
              id="f_phone"
              name="contact_phone"
              type="tel"
              defaultValue={fighter.contact_phone ?? ""}
            />
          </FormField>
          <FormField label="Hometown" htmlFor="f_home">
            <Input
              id="f_home"
              name="hometown"
              defaultValue={fighter.hometown ?? ""}
            />
          </FormField>
          <FormField label="Nationality" htmlFor="f_nat">
            <Input
              id="f_nat"
              name="nationality"
              defaultValue={fighter.nationality ?? ""}
            />
          </FormField>
          <FormField label="Photo URL" htmlFor="f_photo" className="sm:col-span-2">
            <Input
              id="f_photo"
              name="photo_url"
              type="url"
              defaultValue={fighter.photo_url ?? ""}
            />
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm">
              Save fighter info
            </Button>
          </div>
        </ToastedForm>
      </CardContent>
    </Card>
  );
}

function OfficialCard({ official }: { official: Official }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4 w-4" />
          Officiating profile
          <div className="flex flex-wrap gap-1">
            {official.roles.map((r: OfficialRole) => (
              <Badge key={r} variant="secondary" className="capitalize">
                {r}
              </Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ToastedForm
          action={updateMyOfficial}
          successMessage="Officiating info saved"
          className="grid gap-3 sm:grid-cols-2"
        >
          <FormField label="Home state" htmlFor="o_state">
            <Input
              id="o_state"
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
          <FormField label="Contact email" htmlFor="o_email">
            <Input
              id="o_email"
              name="contact_email"
              type="email"
              defaultValue={official.contact_email ?? ""}
            />
          </FormField>
          <FormField label="Contact phone" htmlFor="o_phone">
            <Input
              id="o_phone"
              name="contact_phone"
              type="tel"
              defaultValue={official.contact_phone ?? ""}
            />
          </FormField>
          <FormField
            label="Sports (comma-separated)"
            htmlFor="o_sports"
            className="sm:col-span-2"
            hint="e.g. boxing, mma, kickboxing"
          >
            <Input
              id="o_sports"
              name="sports"
              defaultValue={(official.sports ?? []).join(", ")}
            />
          </FormField>
          <FormField
            label="Certifications (comma-separated)"
            htmlFor="o_certs"
            className="sm:col-span-2"
          >
            <Textarea
              id="o_certs"
              name="certifications"
              rows={2}
              defaultValue={(official.certifications ?? []).join(", ")}
            />
          </FormField>
          <FormField label="Photo URL" htmlFor="o_photo" className="sm:col-span-2">
            <Input
              id="o_photo"
              name="photo_url"
              type="url"
              defaultValue={official.photo_url ?? ""}
            />
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm">
              Save officiating info
            </Button>
          </div>
        </ToastedForm>
      </CardContent>
    </Card>
  );
}
