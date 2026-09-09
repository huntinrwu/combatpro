import { notFound } from "next/navigation";

import { updateGym } from "../../actions";
import { GymForm } from "../../_components/gym-form";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { Gym } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditGymPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const { data: gym } = await db()
    .from("gyms")
    .select("*")
    .eq("id", id)
    .maybeSingle<Gym>();
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
    </>
  );
}
