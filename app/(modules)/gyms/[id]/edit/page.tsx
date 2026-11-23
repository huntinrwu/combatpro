import { notFound } from "next/navigation";

import { updateGym } from "../../actions";
import { GymForm } from "../../_components/gym-form";
import { GymPeopleEditor } from "../../_components/gym-people-editor";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { Coach, Fighter, Gym } from "@/lib/db/types";

export default async function EditGymPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = db();
  const [{ data: gym }, { data: people }, { data: fighters }] = await Promise.all([
    supabase.from("gyms").select("*").eq("id", id).maybeSingle<Gym>(),
    supabase.from("coaches").select("*").eq("gym_id", id).order("full_name"),
    supabase.from("fighters").select("id, full_name, person_id").order("full_name"),
  ]);
  if (!gym) notFound();

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Edit gym</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff-only.</p>
      </header>

      <GymForm
        action={updateGym}
        defaults={gym}
        submitLabel="Save changes"
        cancelHref={`/gyms/${id}`}
        hiddenFields={{ id }}
      />

      <div className="mt-6">
        <GymPeopleEditor
          gymId={id}
          people={(people ?? []) as Coach[]}
          fighters={(fighters ?? []) as Pick<Fighter, "id" | "full_name" | "person_id">[]}
        />
      </div>
    </>
  );
}
