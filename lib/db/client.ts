import { createAdminClient } from "@/lib/supabase/server";

// POC data-access helper: service-role bypass since RLS is off on POC tables.
// When auth lands, swap to createClient() + row-level scoping.
export function db() {
  return createAdminClient();
}
