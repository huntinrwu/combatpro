import { db } from "@/lib/db/client";
import { icsFile } from "@/lib/event-calendar";
import { parsePublicInfo } from "@/lib/public-info";

// Calendar file for a public event. Opening it adds the event to the
// device's own calendar app. Public, like the page it belongs to.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: event } = await db()
    .from("events")
    .select("id, name, event_date, venue, city, state, public_info")
    .eq("slug", slug)
    .in("status", ["scheduled", "complete"])
    .maybeSingle<{
      id: string;
      name: string;
      event_date: string;
      venue: string | null;
      city: string | null;
      state: string | null;
      public_info: unknown;
    }>();
  if (!event) return new Response("Not found", { status: 404 });

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;

  const body = icsFile({
    id: event.id,
    name: event.name,
    date: event.event_date,
    venue: event.venue,
    city: event.city,
    state: event.state,
    info: parsePublicInfo(event.public_info),
    url: `${origin}/e/${slug}`,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
