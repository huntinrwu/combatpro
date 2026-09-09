import { notFound } from "next/navigation";

import { updateFighter } from "../../actions";
import { FighterForm } from "../../_components/fighter-form";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { Fighter, Gym } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditFighterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = db();
  const [{ data: fighter }, { data: gyms }] = await Promise.all([
    supabase.from("fighters").select("*").eq("id", id).maybeSingle<Fighter>(),
    supabase.from("gyms").select("id, name").order("name"),
  ]);
  if (!fighter) notFound();

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Edit fighter</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff-only.</p>
      </header>

      <FighterForm
        action={updateFighter}
        defaults={fighter}
        submitLabel="Save changes"
        cancelHref={`/fighters/${id}`}
        gymList={(gyms ?? []) as Pick<Gym, "id" | "name">[]}
        hiddenFields={{ id }}
      />
    </>
  );
}
