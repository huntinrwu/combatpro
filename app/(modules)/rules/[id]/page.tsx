import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  ClipboardList,
  Download,
  FileText,
  Star,
  Trash2,
  Upload,
} from "lucide-react";

import { deleteRuleset, signedRulesetPdfUrl, uploadNewPdfVersion } from "../actions";
import { db } from "@/lib/db/client";
import { fmtDateShortWithDay as fmtEventDate } from "@/lib/format-utils";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  Bout,
  Commission,
  EventRow,
  Fighter,
  Ruleset,
  RulesetPdfVersion,
  SanctioningBody,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm">
        {value ?? <em className="text-muted-foreground">—</em>}
      </span>
    </div>
  );
}

function YesNo({ v }: { v: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        v
          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          : "border-border/60 text-muted-foreground"
      }
    >
      {v ? "Yes" : "No"}
    </Badge>
  );
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function RulesetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();
  const session = await getSessionUser();

  const [{ data: ruleset }, { data: usedBy }, { data: versions }] = await Promise.all([
    supabase.from("rulesets").select("*").eq("id", id).maybeSingle<Ruleset>(),
    supabase
      .from("bouts")
      .select("id, event_id, bout_order, red_corner_fighter_id, blue_corner_fighter_id")
      .eq("ruleset_id", id),
    supabase
      .from("ruleset_pdf_versions")
      .select("*")
      .eq("ruleset_id", id)
      .order("uploaded_at", { ascending: false }),
  ]);
  if (!ruleset) notFound();

  const versionList = (versions ?? []) as RulesetPdfVersion[];
  const currentVersion = versionList.find((v) => v.is_current) ?? null;
  const historyVersions = versionList.filter((v) => !v.is_current);

  const boutList = (usedBy ?? []) as Pick<
    Bout,
    "id" | "event_id" | "bout_order" | "red_corner_fighter_id" | "blue_corner_fighter_id"
  >[];

  const eventIds = Array.from(new Set(boutList.map((b) => b.event_id)));
  const fighterIds = Array.from(
    new Set(
      boutList
        .flatMap((b) => [b.red_corner_fighter_id, b.blue_corner_fighter_id])
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const [{ data: events }, { data: fighters }, { data: sb }, { data: comm }] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, name, event_date").in("id", eventIds)
      : Promise.resolve({ data: [] as Pick<EventRow, "id" | "name" | "event_date">[] }),
    fighterIds.length
      ? supabase.from("fighters").select("id, full_name").in("id", fighterIds)
      : Promise.resolve({ data: [] as Pick<Fighter, "id" | "full_name">[] }),
    ruleset.sanctioning_body_id
      ? supabase
          .from("sanctioning_bodies")
          .select("id, name, abbreviation")
          .eq("id", ruleset.sanctioning_body_id)
          .maybeSingle<Pick<SanctioningBody, "id" | "name" | "abbreviation">>()
      : Promise.resolve({ data: null }),
    ruleset.commission_id
      ? supabase
          .from("commissions")
          .select("id, name, abbreviation")
          .eq("id", ruleset.commission_id)
          .maybeSingle<Pick<Commission, "id" | "name" | "abbreviation">>()
      : Promise.resolve({ data: null }),
  ]);

  const eventMap = new Map<string, Pick<EventRow, "id" | "name" | "event_date">>();
  for (const e of (events ?? []) as Pick<EventRow, "id" | "name" | "event_date">[]) {
    eventMap.set(e.id, e);
  }
  const fighterMap = new Map<string, string>();
  for (const f of (fighters ?? []) as Pick<Fighter, "id" | "full_name">[]) {
    fighterMap.set(f.id, f.full_name);
  }

  const currentPdfUrl = currentVersion
    ? await signedRulesetPdfUrl(currentVersion.storage_path)
    : null;
  const historyUrls = await Promise.all(
    historyVersions.map((v) => signedRulesetPdfUrl(v.storage_path)),
  );

  const backHref = comm
    ? `/registry/commissions/${comm.id}`
    : sb
      ? `/sb/${sb.id}`
      : "/registry";

  return (
    <>
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {ruleset.name}
            </h1>
            {ruleset.is_default && (
              <Badge variant="secondary">
                <Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" />
                Default
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="outline" className="capitalize">
              {ruleset.sport}
            </Badge>
            {comm && (
              <>
                <span>
                  Commission:{" "}
                  <Link href={`/registry/commissions/${comm.id}`} className="hover:underline">
                    {comm.abbreviation} — {comm.name}
                  </Link>
                </span>
              </>
            )}
            {sb && (
              <>
                {comm && <span>·</span>}
                <span>
                  Body:{" "}
                  <Link href={`/sb/${sb.id}`} className="hover:underline">
                    {sb.abbreviation} — {sb.name}
                  </Link>
                </span>
              </>
            )}
            <span>·</span>
            <span>
              Used by {boutList.length} bout{boutList.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {session?.isStaff && (
          <form action={deleteRuleset}>
            <input type="hidden" name="id" value={ruleset.id} />
            <Button type="submit" variant="ghost" size="sm">
              <Trash2 className="h-3.5 w-3.5" />
              Delete ruleset
            </Button>
          </form>
        )}
      </header>

      {currentVersion?.extraction_error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">PDF extraction failed</div>
            <p className="mt-0.5 text-xs">
              The PDF is stored but Claude could not parse structured fields. Details:{" "}
              <span className="font-mono">{currentVersion.extraction_error}</span>
            </p>
          </div>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Current PDF
          </CardTitle>
          {currentVersion && currentPdfUrl && (
            <Button
              size="sm"
              variant="outline"
              render={
                <a href={currentPdfUrl} target="_blank" rel="noopener">
                  <Download className="h-3 w-3" />
                  Open PDF
                </a>
              }
            />
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {currentVersion ? (
            <div className="text-sm">
              <div className="font-medium">
                {currentVersion.original_filename ?? "ruleset.pdf"}
              </div>
              <div className="text-xs text-muted-foreground">
                Uploaded {new Date(currentVersion.uploaded_at).toLocaleString()}
                {currentVersion.file_size_bytes
                  ? ` · ${fmtSize(currentVersion.file_size_bytes)}`
                  : ""}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No PDF on file yet. Upload one below.
            </p>
          )}
          {session?.isStaff && (
            <form
              action={uploadNewPdfVersion}
              encType="multipart/form-data"
              className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-3"
            >
              <input type="hidden" name="ruleset_id" value={ruleset.id} />
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Upload new PDF
                </label>
                <Input name="pdf" type="file" accept="application/pdf" required />
              </div>
              <Button type="submit">
                <Upload className="h-3.5 w-3.5" />
                Replace &amp; re-parse
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mb-3 text-xs text-muted-foreground">
        Fields below are auto-extracted from the current PDF. Read-only —
        {session?.isStaff
          ? " upload a new PDF to update."
          : " ask staff to upload a new version to update."}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rounds &amp; scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Championship rounds" value={ruleset.rounds_championship} />
            <DetailRow label="Non-championship rounds" value={ruleset.rounds_non_championship} />
            <DetailRow
              label="Round length"
              value={
                ruleset.round_length_minutes != null
                  ? `${ruleset.round_length_minutes} min`
                  : null
              }
            />
            <DetailRow
              label="Rest"
              value={
                ruleset.rest_length_seconds != null
                  ? `${ruleset.rest_length_seconds} sec`
                  : null
              }
            />
            <DetailRow
              label="Scoring"
              value={ruleset.scoring_mode?.replace(/_/g, " ") ?? null}
            />
            <DetailRow
              label="Weight allowance"
              value={
                ruleset.weight_allowance_lbs != null
                  ? `${ruleset.weight_allowance_lbs} lbs`
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules toggles</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Three-knockdown rule"
              value={<YesNo v={ruleset.three_knockdown_rule} />}
            />
            <DetailRow
              label="Standing 8-count"
              value={<YesNo v={ruleset.standing_eight_count} />}
            />
            <DetailRow label="Open scoring" value={<YesNo v={ruleset.open_scoring} />} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenText className="h-4 w-4" />
            Equipment &amp; notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Gloves
            </div>
            {ruleset.glove_specs ? (
              <p className="whitespace-pre-wrap">{ruleset.glove_specs}</p>
            ) : (
              <em className="text-muted-foreground">—</em>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Wraps
            </div>
            {ruleset.wraps_spec ? (
              <p className="whitespace-pre-wrap">{ruleset.wraps_spec}</p>
            ) : (
              <em className="text-muted-foreground">—</em>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Protective gear
            </div>
            {ruleset.protective_gear ? (
              <p className="whitespace-pre-wrap">{ruleset.protective_gear}</p>
            ) : (
              <em className="text-muted-foreground">—</em>
            )}
          </div>
          {ruleset.notes && (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Notes
              </div>
              <p className="whitespace-pre-wrap">{ruleset.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {historyVersions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Version history ({historyVersions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {historyVersions.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 p-3 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {v.original_filename ?? "ruleset.pdf"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Uploaded {new Date(v.uploaded_at).toLocaleString()}
                      {v.file_size_bytes ? ` · ${fmtSize(v.file_size_bytes)}` : ""}
                      {v.extraction_error && " · extraction failed"}
                    </div>
                  </div>
                  {historyUrls[i] && (
                    <Button
                      size="sm"
                      variant="ghost"
                      render={
                        <a href={historyUrls[i]!} target="_blank" rel="noopener">
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Bouts using this ruleset ({boutList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {boutList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No bouts linked yet. Assign this ruleset from any bout&apos;s detail page.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {boutList.map((b) => {
                const ev = eventMap.get(b.event_id);
                const redName = b.red_corner_fighter_id
                  ? fighterMap.get(b.red_corner_fighter_id) ?? "TBD"
                  : "TBD";
                const blueName = b.blue_corner_fighter_id
                  ? fighterMap.get(b.blue_corner_fighter_id) ?? "TBD"
                  : "TBD";
                return (
                  <li key={b.id} className="p-3 text-sm hover:bg-muted/40">
                    <Link
                      href={`/events/${b.event_id}/bouts/${b.id}`}
                      className="hover:underline"
                    >
                      <div className="font-medium">
                        {redName} vs {blueName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ev ? `${ev.name} · ${fmtEventDate(ev.event_date)}` : "(missing event)"}
                        {b.bout_order != null && <> · Bout {b.bout_order}</>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
