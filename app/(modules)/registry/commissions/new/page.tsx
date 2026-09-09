import { createCommission } from "../../actions";
import { CommissionForm } from "../../_components/commission-form";
import { requireStaff } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewCommissionPage() {
  await requireStaff();
  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New commission</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff-only.</p>
      </header>

      <CommissionForm
        action={createCommission}
        submitLabel="Create commission"
        cancelHref="/registry"
      />
    </>
  );
}
