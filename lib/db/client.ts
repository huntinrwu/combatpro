import { createAdminClient } from "@/lib/supabase/server";

// POC data-access helper: service-role bypass since RLS is off on POC tables.
// When auth lands, swap to createClient() + row-level scoping.
export function db() {
  return createAdminClient();
}

// Swallow Supabase Postgres errors so we don't leak schema/constraint details
// to the client. Logs the real error server-side, throws a stable generic
// message that ToastedForm surfaces to the user.
export function dbErr(
  error: { message?: string | null; code?: string | null; details?: string | null } | null,
  fallback = "Something went wrong. Please try again.",
): never {
  console.error("[db]", error?.code ?? "?", error?.message, error?.details ?? "");
  throw new Error(fallback);
}
