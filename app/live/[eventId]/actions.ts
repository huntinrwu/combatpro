"use server";

import { requireStaff } from "@/lib/auth/session";
import { declareBoutResult } from "../../(modules)/events/[id]/bouts/[boutId]/actions";
import { advanceToNextBout } from "../../(modules)/events/actions";

// One-click "declare + advance" for the control room. declareBoutResult writes
// the outcome and updates fighter records; advanceToNextBout then finds the
// next undeclared bout and points event.current_bout_id at it.
export async function declareResultAndAdvance(formData: FormData) {
  await requireStaff();
  await declareBoutResult(formData);

  // declareBoutResult throws unless both ids are present.
  const advance = new FormData();
  advance.set("event_id", String(formData.get("event_id")));
  advance.set("current_bout_id", String(formData.get("bout_id")));
  await advanceToNextBout(advance);
}
