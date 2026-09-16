import { createAdminClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import type { PlatformRole } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SVG is intentionally excluded — it can carry <script>/foreignObject that
// executes when served from the same origin (stored XSS).
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

// Magic-byte sniffing — client-supplied MIME is not trusted. Returns the
// detected MIME or null if the bytes don't match one of the allowed formats.
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // GIF: "GIF87a" or "GIF89a"
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) return "image/gif";
  // WEBP: "RIFF"...."WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

type Kind = {
  folder: string;
  maxBytes: number;
  // Roles allowed to upload (staff always allowed). Empty = any signed-in user.
  requireRoles?: PlatformRole[];
};

// Whitelist — keeps the dynamic route from being a generic anonymous upload
// endpoint. Anything not listed here 404s. Adjust folder and role gates per
// entity as new upload kinds are added.
const KINDS: Record<string, Kind> = {
  "sponsor-logo": {
    folder: "sponsors",
    maxBytes: 4 * 1024 * 1024,
    requireRoles: ["promoter"],
  },
  "fighter-photo": {
    folder: "fighters",
    maxBytes: 6 * 1024 * 1024,
    requireRoles: ["promoter", "coach", "gym_owner", "fighter"],
  },
  "official-photo": {
    folder: "officials",
    maxBytes: 6 * 1024 * 1024,
    requireRoles: ["promoter", "sanctioning_body", "commission", "official"],
  },
  "gym-logo": {
    folder: "gyms",
    maxBytes: 4 * 1024 * 1024,
    requireRoles: ["gym_owner", "coach", "promoter"],
  },
  "promotion-logo": {
    folder: "promotions",
    maxBytes: 4 * 1024 * 1024,
    requireRoles: ["promoter"],
  },
  "sb-logo": {
    folder: "sanctioning-bodies",
    maxBytes: 4 * 1024 * 1024,
    requireRoles: ["sanctioning_body", "commission"],
  },
  "commission-logo": {
    folder: "commissions",
    maxBytes: 4 * 1024 * 1024,
    requireRoles: ["commission"],
  },
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  // CSRF: multipart/form-data can be submitted cross-origin from any page.
  // Require Origin (or Referer) to match the request Host.
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  const host = req.headers.get("host");
  if (!origin || !host) return new Response("Forbidden", { status: 403 });
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) return new Response("Forbidden", { status: 403 });
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const { kind: kindSlug } = await params;
  const kind = KINDS[kindSlug];
  if (!kind) return new Response("Unknown upload kind", { status: 404 });

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const allowed =
    user.isStaff ||
    !kind.requireRoles ||
    kind.requireRoles.some((r) => user.approvedRoles.includes(r));
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response("Missing file", { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return new Response(`Unsupported type: ${file.type}`, { status: 415 });
  }
  if (file.size > kind.maxBytes) {
    return new Response(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > ${(
        kind.maxBytes /
        1024 /
        1024
      ).toFixed(0)}MB)`,
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMime(bytes);
  if (!sniffed || sniffed !== file.type) {
    return new Response("File content does not match declared type", { status: 415 });
  }

  const ext = extFor(sniffed);
  const key = `${kind.folder}/${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from("media")
    .upload(key, bytes, {
      contentType: sniffed,
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) {
    console.error("[upload]", error.message);
    return new Response("Upload failed", { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(key);

  return Response.json({ url: publicUrl, key });
}
