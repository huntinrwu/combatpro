import { notFound } from "next/navigation";

import { updateSanctioningBody } from "../../../registry/actions";
import { SanctioningBodyForm } from "../../../registry/_components/sanctioning-body-form";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { SanctioningBody } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditSanctioningBodyPage({
  params,
}: {
  params: Promise<{ bodyId: string }>;
}) {
  await requireStaff();
  const { bodyId } = await params;

  const { data: body } = await db()
    .from("sanctioning_bodies")
    .select("*")
    .eq("id", bodyId)
    .maybeSingle<SanctioningBody>();
  if (!body) notFound();

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Edit sanctioning body
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff-only.</p>
      </header>

      <SanctioningBodyForm
        action={updateSanctioningBody}
        defaults={body}
        submitLabel="Save changes"
        cancelHref={`/sb/${bodyId}`}
        hiddenFields={{ id: bodyId }}
      />
    </>
  );
}
