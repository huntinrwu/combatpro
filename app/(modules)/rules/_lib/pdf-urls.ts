import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";

export const RULESET_PDF_BUCKET = "ruleset-pdfs";

// Short-lived signed URLs for ruleset PDFs, one storage round-trip for the
// whole batch. Server-only (plain module, not a server action) — returns all
// nulls for signed-out viewers. Output is index-aligned with `storagePaths`.
export async function signedRulesetPdfUrls(storagePaths: string[]): Promise<(string | null)[]> {
  if (storagePaths.length === 0) return [];
  const u = await getSessionUser();
  if (!u) return storagePaths.map(() => null);
  const { data } = await db()
    .storage.from(RULESET_PDF_BUCKET)
    .createSignedUrls(storagePaths, 60 * 10);
  return storagePaths.map((_, i) => data?.[i]?.signedUrl ?? null);
}
