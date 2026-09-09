import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import type { SearchHit } from "@/app/_components/dashboard/search-types";
import type { EventRow, Fighter } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ hits: [] });

  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const supabase = db();

  const [{ data: fighters }, { data: events }] = await Promise.all([
    supabase
      .from("fighters")
      .select("id, full_name, nickname, primary_sport, weight_class")
      .or(`full_name.ilike.${like},nickname.ilike.${like}`)
      .limit(5),
    supabase
      .from("events")
      .select("id, name, event_date, city, state, slug")
      .ilike("name", like)
      .order("event_date", { ascending: false })
      .limit(5),
  ]);

  const hits: SearchHit[] = [];

  for (const f of (fighters ?? []) as Pick<
    Fighter,
    "id" | "full_name" | "nickname" | "primary_sport" | "weight_class"
  >[]) {
    const subtitleBits = [
      f.nickname ? `"${f.nickname}"` : null,
      f.weight_class,
      f.primary_sport,
    ].filter(Boolean);
    hits.push({
      kind: "fighter",
      id: f.id,
      title: f.full_name,
      subtitle: subtitleBits.length ? subtitleBits.join(" · ") : null,
      href: `/fighters/${f.id}`,
    });
  }

  for (const e of (events ?? []) as Pick<
    EventRow,
    "id" | "name" | "event_date" | "city" | "state" | "slug"
  >[]) {
    const loc = [e.city, e.state].filter(Boolean).join(", ");
    const subtitleBits = [e.event_date, loc || null].filter(Boolean);
    hits.push({
      kind: "event",
      id: e.id,
      title: e.name,
      subtitle: subtitleBits.length ? subtitleBits.join(" · ") : null,
      href: e.slug ? `/e/${e.slug}` : `/events/${e.id}`,
    });
  }

  return Response.json({ hits });
}
