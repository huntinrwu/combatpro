import Link from "next/link";
import { CheckCircle2, Download, FileText, RotateCcw } from "lucide-react";

import { markDocumentFiled, unmarkDocumentFiled } from "../document-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOUT_DOCUMENT_KINDS,
  type BoutDocument,
  type BoutDocumentKind,
} from "@/lib/db/types";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DocumentsCard({
  boutId,
  eventId,
  documents,
  sanctioningBodyName,
  resultDeclared,
}: {
  boutId: string;
  eventId: string;
  documents: BoutDocument[];
  sanctioningBodyName: string | null;
  resultDeclared: boolean;
}) {
  const byKind = new Map<BoutDocumentKind, BoutDocument>();
  for (const d of documents) byKind.set(d.kind, d);

  return (
    <div className="space-y-4">
      {BOUT_DOCUMENT_KINDS.map((k) => {
        const filed = byKind.get(k.value);
        const isReport = k.value === "fight_report";
        const disabledReason = isReport && !resultDeclared ? "Declare the result first." : null;

        return (
          <div key={k.value} className="rounded-lg border border-border/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{k.label}</span>
                  {filed && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Filed
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
                {filed && (
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <div>Filed {fmtWhen(filed.filed_at)}</div>
                    {filed.filed_with && <div>With: {filed.filed_with}</div>}
                    {filed.filed_by && <div>By: {filed.filed_by}</div>}
                    {filed.reference && <div>Ref: {filed.reference}</div>}
                    {filed.notes && (
                      <div className="italic">&ldquo;{filed.notes}&rdquo;</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(disabledReason)}
                  render={
                    disabledReason ? (
                      <button type="button" title={disabledReason} disabled>
                        <Download className="h-3.5 w-3.5" />
                        Preview
                      </button>
                    ) : (
                      <Link
                        href={`/api/bouts/${boutId}/documents/${k.value}`}
                        target="_blank"
                        rel="noopener"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Preview
                      </Link>
                    )
                  }
                />
              </div>
            </div>

            {!filed && !disabledReason && (
              <form
                action={markDocumentFiled}
                className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <input type="hidden" name="bout_id" value={boutId} />
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value={k.value} />
                <Input
                  name="filed_with"
                  placeholder={`Sanctioning body${sanctioningBodyName ? ` (${sanctioningBodyName})` : ""}`}
                  defaultValue={sanctioningBodyName ?? ""}
                />
                <Input name="filed_by" placeholder="Filed by (name)" />
                <Input name="reference" placeholder="Ref #" />
                <Button type="submit" size="sm">
                  Mark as filed
                </Button>
              </form>
            )}

            {filed && (
              <form action={unmarkDocumentFiled} className="mt-3 border-t border-border/60 pt-3">
                <input type="hidden" name="bout_id" value={boutId} />
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value={k.value} />
                <Button type="submit" size="sm" variant="ghost">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Unfile
                </Button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
