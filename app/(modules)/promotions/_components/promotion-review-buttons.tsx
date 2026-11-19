import { Check, X } from "lucide-react";

import { setPromotionStatus } from "../actions";
import { Button } from "@/components/ui/button";

// Staff approve / reject pair for a pending promotion.
export function PromotionReviewButtons({
  id,
  iconClassName = "h-3 w-3",
}: {
  id: string;
  iconClassName?: string;
}) {
  return (
    <>
      <form action={setPromotionStatus}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="approved" />
        <Button size="sm" variant="outline">
          <Check className={iconClassName} />
          Approve
        </Button>
      </form>
      <form action={setPromotionStatus}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="rejected" />
        <Button size="sm" variant="ghost">
          <X className={iconClassName} />
          Reject
        </Button>
      </form>
    </>
  );
}
