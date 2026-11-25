import { fmtClock, type PublicInfo } from "@/lib/public-info";

// What a calendar entry for a public event needs.
export type CalendarEvent = {
  id: string;
  name: string;
  // Plain YYYY-MM-DD.
  date: string;
  venue: string | null;
  city: string | null;
  state: string | null;
  info: PublicInfo;
  // Address of the public event page.
  url: string;
};

// How long an entry lasts when the event has a start time.
const DEFAULT_HOURS = 4;

const pad = (n: number) => String(n).padStart(2, "0");

// The entry starts when doors open, or when fights start if no doors time is
// set. With neither it is an all-day entry. Times carry no time zone, so they
// land at that clock time on the visitor's own calendar, which is right for
// people going to a local event.
function span(e: CalendarEvent): { allDay: boolean; start: string; end: string } {
  const [y, m, d] = e.date.split("-").map(Number);
  const clock = e.info.doors ?? e.info.start;
  if (!clock) {
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return {
      allDay: true,
      start: `${y}${pad(m)}${pad(d)}`,
      end: `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`,
    };
  }
  const [h, min] = clock.split(":").map(Number);
  const s = new Date(Date.UTC(y, m - 1, d, h, min));
  const f = new Date(s.getTime() + DEFAULT_HOURS * 3600_000);
  const stamp = (t: Date) =>
    `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
  return { allDay: false, start: stamp(s), end: stamp(f) };
}

function location(e: CalendarEvent): string {
  const a = e.info.address;
  // A complete address is used as typed; a bare street gets the city and state.
  const full =
    !!a &&
    (/\b\d{5}\b/.test(a) ||
      [e.city, e.state].some((p) => p && a.toLowerCase().includes(p.toLowerCase())));
  return [e.venue, ...(full ? [a] : [a, e.city, e.state])].filter(Boolean).join(", ");
}

function details(e: CalendarEvent): string {
  const doors = fmtClock(e.info.doors);
  const start = fmtClock(e.info.start);
  return [
    [doors && `Doors open ${doors}`, start && `Fights start ${start}`].filter(Boolean).join(" · "),
    e.info.admission,
    e.url,
  ]
    .filter(Boolean)
    .join("\n");
}

// A link that opens Google Calendar with the entry filled in.
export function googleCalendarUrl(e: CalendarEvent): string {
  const { start, end } = span(e);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.name,
    dates: `${start}/${end}`,
    details: details(e),
    location: location(e),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// An .ics file: the format Apple Calendar, Outlook and phone calendar apps open.
export function icsFile(e: CalendarEvent): string {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const { allDay, start, end } = span(e);
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CombatPro//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@combatpro`,
    `DTSTAMP:${stamp}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${esc(e.name)}`,
    `LOCATION:${esc(location(e))}`,
    `DESCRIPTION:${esc(details(e))}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Lines longer than 75 bytes are folded, as the format requires.
  return lines
    .map((l) => l.match(/.{1,73}/gu)?.join("\r\n ") ?? l)
    .join("\r\n")
    .concat("\r\n");
}
