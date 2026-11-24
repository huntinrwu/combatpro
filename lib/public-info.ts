// What a promoter writes for the public event page (events.public_info, a
// JSON column). Every field is optional; new ones can be added here without
// a database change.
export type PublicInfo = {
  // Street address of the venue.
  address: string | null;
  // 24-hour "HH:MM", as a time input gives it.
  doors: string | null;
  start: string | null;
  // e.g. "Free admission, spectators welcome" or "$20 at the door".
  admission: string | null;
  ticketUrl: string | null;
  // Free text: parking, what to bring, contact, anything else.
  about: string | null;
};

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const time = (v: unknown): string | null =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim() : null;
// Only real web links: never javascript: or other schemes on a public page.
const url = (v: unknown): string | null => {
  const t = text(v, 500);
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

export function parsePublicInfo(raw: unknown): PublicInfo {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    address: text(r.address, 200),
    doors: time(r.doors),
    start: time(r.start),
    admission: text(r.admission, 200),
    ticketUrl: url(r.ticketUrl),
    about: text(r.about, 3000),
  };
}

// From the event form's public_* fields.
export function publicInfoFromForm(formData: FormData): PublicInfo {
  return parsePublicInfo({
    address: formData.get("public_address"),
    doors: formData.get("public_doors"),
    start: formData.get("public_start"),
    admission: formData.get("public_admission"),
    ticketUrl: formData.get("public_ticket_url"),
    about: formData.get("public_about"),
  });
}

// "18:00" -> "6:00 PM".
export function fmtClock(hhmm: string | null): string | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
