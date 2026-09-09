import { createBrowserClient } from "@supabase/ssr";

// Anon-key browser client for read-only subscriptions from client components
// (Realtime on the public event page, etc). Writes still go through server
// actions using the service-role client in lib/supabase/server.ts.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
