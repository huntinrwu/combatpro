"use server";

import { declareBoutResult } from "../../(modules)/events/[id]/bouts/[boutId]/actions";
import { advanceToNextBout } from "../../(modules)/events/actions";

// One-click "declare + advance" for the control room. declareBoutResult writes
// the outcome and updates fighter records; advanceToNextBout then finds the
// next undeclared bout and points event.current_bout_id at it.
export async function declareResultAndAdvance(formData: FormData) {
  await declareBoutResult(formData);

  const event_id = formData.get("event_id")?.toString();
  const bout_id = formData.get("bout_id")?.toString();
  if (!event_id || !bout_id) return;

  const advance = new FormData();
  advance.set("event_id", event_id);
  advance.set("current_bout_id", bout_id);
  await advanceToNextBout(advance);
}
