import { notFound } from "next/navigation";

import { updateOfficial } from "../../actions";
import { OfficialForm } from "../../_components/official-form";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { Official } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditOfficialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const { data: official } = await db()
    .from("officials")
    .select("*")
    .eq("id", id)
    .maybeSingle<Official>();
  if (!official) notFound();

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Edit official</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff-only.</p>
      </header>

      <OfficialForm
        action={updateOfficial}
        defaults={official}
        submitLabel="Save changes"
        cancelHref={`/officials/${id}`}
        hiddenFields={{ id }}
      />
    </>
  );
}
