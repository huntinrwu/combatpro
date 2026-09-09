import { notFound } from "next/navigation";

import { updatePromotion } from "../../actions";
import { PromotionForm } from "../../_components/promotion-form";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { Promotion } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const { data: promotion } = await db()
    .from("promotions")
    .select("*")
    .eq("id", id)
    .maybeSingle<Promotion>();
  if (!promotion) notFound();

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Edit promotion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff-only.</p>
      </header>

      <PromotionForm
        action={updatePromotion}
        defaults={promotion}
        submitLabel="Save changes"
        cancelHref={`/promotions/${id}`}
        hiddenFields={{ id }}
      />
    </>
  );
}
