import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpenText, Pencil, Plus, Star } from "lucide-react";

import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Commission, Ruleset } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function CommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = db();
  const session = await getSessionUser();

  const [{ data: commission }, { data: rulesets }] = await Promise.all([
    supabase.from("commissions").select("*").eq("id", id).maybeSingle<Commission>(),
    supabase.from("rulesets").select("*").eq("commission_id", id).order("sport"),
  ]);
  if (!commission) notFound();

  const rules = (rulesets ?? []) as Ruleset[];

  return (
    <>
      <Link
        href="/registry"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Registry
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {commission.name}
            </h1>
            <Badge variant="secondary">{commission.abbreviation}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{commission.jurisdiction}</span>
            {commission.state && (
              <>
                <span>·</span>
                <span>{commission.state}</span>
              </>
            )}
            {commission.website && (
              <>
                <span>·</span>
                <a
                  href={commission.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-foreground"
                >
                  site
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </>
            )}
          </div>
        </div>
        {session?.isStaff && (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link href={`/registry/commissions/${commission.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            }
          />
        )}
      </header>

      {commission.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{commission.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenText className="h-4 w-4" />
            Rulesets ({rules.length})
          </CardTitle>
          {session?.isStaff && (
            <Button
              size="sm"
              render={
                <Link href={`/rules/new?commission=${commission.id}`}>
                  <Plus className="h-3.5 w-3.5" />
                  New ruleset
                </Link>
              }
            />
          )}
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rulesets yet for this commission.
              {session?.isStaff && " Click New ruleset to add one."}
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-3 text-sm hover:bg-muted/40">
                  <Badge variant="outline" className="capitalize">
                    {r.sport}
                  </Badge>
                  <Link href={`/rules/${r.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                    {r.name}
                    {r.is_default && (
                      <Star className="ml-1 inline h-3 w-3 fill-amber-400 text-amber-400" />
                    )}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {r.rounds_championship ?? r.rounds_non_championship ?? "—"}
                    {r.round_length_minutes != null && <> × {r.round_length_minutes}m</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
