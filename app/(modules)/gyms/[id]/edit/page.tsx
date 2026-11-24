import { notFound } from "next/navigation";

import { updateGym } from "../../actions";
import { GymForm } from "../../_components/gym-form";
import { GymPeopleEditor, type ProfileOption } from "../../_components/gym-people-editor";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { Coach, Gym } from "@/lib/db/types";

export default async function EditGymPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = db();
  const [{ data: gym }, { data: people }, { data: fighters }, { data: officials }] = await Promise.all([
    supabase.from("gyms").select("*").eq("id", id).maybeSingle<Gym>(),
    supabase.from("coaches").select("*").eq("gym_id", id).order("full_name"),
    supabase.from("fighters").select("id, full_name, person_id").order("full_name"),
    supabase.from("officials").select("id, full_name, person_id").order("full_name"),
  ]);
  if (!gym) notFound();

  type Row = { id: string; full_name: string; person_id: string | null };
  const profiles: ProfileOption[] = [
    ...((fighters ?? []) as Row[]).map((f) => ({ kind: "fighter" as const, ...f })),
    ...((officials ?? []) as Row[]).map((o) => ({ kind: "official" as const, ...o })),
  ];

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
          fighters={profiles}
        />
      </div>
    </>
  );
}
