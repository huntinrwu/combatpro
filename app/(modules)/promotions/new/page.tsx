import { createPromotion } from "../actions";
import { PromotionForm } from "../_components/promotion-form";
import { requireStaff } from "@/lib/auth/session";

export default async function NewPromotionPage() {
  await requireStaff();
  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New promotion</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Staff-only. Created promotions land as approved.
        </p>
      </header>

      <PromotionForm
        action={createPromotion}
        submitLabel="Create promotion"
        cancelHref="/promotions"
      />
    </>
  );
}
