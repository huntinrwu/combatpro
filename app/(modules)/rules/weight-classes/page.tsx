import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SPORTS } from "@/lib/db/types";
import { weightClassesForSport, type WeightClass } from "@/lib/weight-classes";

export default function WeightClassesPage() {
  return (
    <>
      <header className="mb-6">
        <Link
          href="/rules"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Rules
        </Link>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Weight-class tables
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canonical cutoffs per sport. Bout weight classes auto-populate from
          contracted weight when creating a bout, and mismatches surface on the
          bout agreement PDF.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {SPORTS.map((sport) => {
          const table = weightClassesForSport(sport);
          return (
            <Card key={sport}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base capitalize">
                  <Scale className="h-4 w-4" />
                  {sport}
                  {!table && (
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      no table
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {table ? (
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-1 font-medium">Class</th>
                        <th className="pb-1 text-right font-medium">Upper (lbs)</th>
                        <th className="pb-1 text-right font-medium">Upper (kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {table.map((wc: WeightClass) => (
                        <tr key={wc.name}>
                          <td className="py-1.5">{wc.name}</td>
                          <td className="py-1.5 text-right font-mono text-xs">
                            {Number.isFinite(wc.upper_lbs) ? wc.upper_lbs : "no limit"}
                          </td>
                          <td className="py-1.5 text-right font-mono text-xs text-muted-foreground">
                            {Number.isFinite(wc.upper_kg) ? wc.upper_kg : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No canonical table shipped for this sport yet.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
