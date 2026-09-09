import { createAdminClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import type { PlatformRole } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/gif") return "gif";
  return "bin";
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

  const ext = extFor(file.type);
  const key = `${kind.folder}/${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from("media")
    .upload(key, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) return new Response(error.message, { status: 500 });

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(key);

  return Response.json({ url: publicUrl, key });
}
