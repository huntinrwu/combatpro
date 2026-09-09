import { submitPromotion } from "../actions";
import { PromotionForm } from "../_components/promotion-form";
import { requireUser } from "@/lib/auth/session";

export default async function SubmitPromotionPage() {
  await requireUser();
  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Submit a promotion
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Add your promotion to the CombatPro registry. Submissions are reviewed by staff before
          appearing publicly — this keeps duplicates out and lets us verify identity. Approval is
          usually fast.
        </p>
      </header>

      <PromotionForm
        action={submitPromotion}
        submitLabel="Submit for review"
        cancelHref="/promotions"
        submitterMode
      />
    </>
  );
}
