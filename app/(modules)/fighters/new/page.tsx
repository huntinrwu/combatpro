import { createFighter } from "../actions";
import { FighterForm } from "../_components/fighter-form";
import { db } from "@/lib/db/client";
import type { Gym } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function NewFighterPage() {
  const { data: gyms } = await db().from("gyms").select("id, name").order("name");
  const gymList = (gyms ?? []) as Pick<Gym, "id" | "name">[];

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New fighter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only name and sport are required.
        </p>
      </header>

      <FighterForm
        action={createFighter}
        submitLabel="Create fighter"
        cancelHref="/fighters"
        gymList={gymList}
      />
    </>
  );
}
