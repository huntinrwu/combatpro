import { notFound } from "next/navigation";

import { updateCommission } from "../../../actions";
import { CommissionForm } from "../../../_components/commission-form";
import { db } from "@/lib/db/client";
import { requireStaff } from "@/lib/auth/session";
import type { Commission } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function EditCommissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const { data: commission } = await db()
    .from("commissions")
    .select("*")
    .eq("id", id)
    .maybeSingle<Commission>();
  if (!commission) notFound();

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Edit commission</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff-only.</p>
      </header>

      <CommissionForm
        action={updateCommission}
        defaults={commission}
        submitLabel="Save changes"
        cancelHref={`/registry/commissions/${id}`}
        hiddenFields={{ id }}
      />
    </>
  );
}
