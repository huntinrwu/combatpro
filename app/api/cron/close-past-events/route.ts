import { closePastEvents } from "@/lib/db/close-past-events";

// Daily Vercel cron (see vercel.json). Takes no input and only closes events
// that are already past, so it is harmless to call; when CRON_SECRET is set in
// the environment Vercel sends it as a bearer token and we require it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const closed = await closePastEvents();
  return Response.json({ closed });
}
