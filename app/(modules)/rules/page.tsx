import Link from "next/link";
import { Plus, Scale, Search, Star, X } from "lucide-react";

import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ViewSwitcher } from "@/components/view-switcher";
import { KanbanBoard } from "@/components/views/kanban";
import { CardGrid, CompactList, TableShell, TileGrid } from "@/components/views/containers";
import { pickView } from "@/lib/view-mode";
import { SPORTS, type Ruleset, type SanctioningBody } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const VIEWS = ["list", "card", "grid", "compact", "kanban"] as const;

type Search = { q?: string; sport?: string; sb?: string; view?: string };

type SbLite = Pick<SanctioningBody, "id" | "name" | "abbreviation">;

export default async function RulesListPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { q = "", sport = "", sb = "", view: rawView } = await searchParams;
  const view = pickView(rawView, VIEWS);

  const supabase = db();

  const [{ data: rulesets, error }, { data: sbs }] = await Promise.all([
    supabase.from("rulesets").select("*").order("name"),
    supabase.from("sanctioning_bodies").select("id, name, abbreviation").order("name"),
  ]);

  const sbMap = new Map<string, SbLite>();
  for (const s of (sbs ?? []) as SbLite[]) sbMap.set(s.id, s);

  const list = ((rulesets ?? []) as Ruleset[]).filter((r) => {
    if (sport && r.sport !== sport) return false;
    if (sb) {
      if (sb === "__none__" && r.sanctioning_body_id) return false;
      if (sb !== "__none__" && r.sanctioning_body_id !== sb) return false;
    }
    if (q) {
      const needle = q.toLowerCase();
      if (
        !r.name.toLowerCase().includes(needle) &&
        !(r.notes ?? "").toLowerCase().includes(needle) &&
        !(r.glove_specs ?? "").toLowerCase().includes(needle)
      )
        return false;
    }
    return true;
  });

  const anyFilter = Boolean(q || sport || sb);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Rulesets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable rule packs — per sanctioning body + sport. Linked to bouts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher views={[...VIEWS]} current={view} />
          <Button
            variant="outline"
            render={
              <Link href="/rules/weight-classes">
                <Scale className="h-4 w-4" />
                Weight classes
              </Link>
            }
          />
          <Button
            render={
              <Link href="/rules/new">
                <Plus className="h-4 w-4" />
                New ruleset
              </Link>
            }
          />
        </div>
      </header>

      <form
        method="get"
        className="mb-4 grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
      >
        {view !== VIEWS[0] && <input type="hidden" name="view" value={view} />}
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search name, notes, gloves"
            className="pl-7"
          />
        </label>
        <NativeSelect name="sport" defaultValue={sport}>
          <option value="">All sports</option>
          {SPORTS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="sb" defaultValue={sb}>
          <option value="">All bodies</option>
          <option value="__none__">— House rules —</option>
          {[...sbMap.values()].map((s) => (
            <option key={s.id} value={s.id}>
              {s.abbreviation} — {s.name}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-1">
          <Button type="submit" size="sm">
            Filter
          </Button>
          {anyFilter && (
            <Button size="sm" variant="ghost" render={<Link href="/rules">Reset</Link>}>
              <X className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {anyFilter ? "No rulesets match those filters." : "No rulesets yet."}
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-muted-foreground">
            Showing {list.length} of {rulesets?.length ?? 0}
          </div>
          {view === "list" && <ListView rulesets={list} sbMap={sbMap} />}
          {view === "card" && <CardView rulesets={list} sbMap={sbMap} />}
          {view === "grid" && <GridView rulesets={list} sbMap={sbMap} />}
          {view === "compact" && <CompactView rulesets={list} sbMap={sbMap} />}
          {view === "kanban" && <KanbanView rulesets={list} sbMap={sbMap} />}
        </>
      )}
    </>
  );
}

function sbLabel(r: Ruleset, sbMap: Map<string, SbLite>): string {
  if (!r.sanctioning_body_id) return "house";
  return sbMap.get(r.sanctioning_body_id)?.abbreviation ?? "?";
}

function ListView({ rulesets, sbMap }: { rulesets: Ruleset[]; sbMap: Map<string, SbLite> }) {
  return (
    <TableShell
      head={
        <tr>
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Sport</th>
          <th className="px-3 py-2 font-medium">Sanctioning body</th>
          <th className="px-3 py-2 font-medium">Rounds</th>
          <th className="px-3 py-2 font-medium">Scoring</th>
        </tr>
      }
    >
      {rulesets.map((r) => (
            <tr key={r.id} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <Link href={`/rules/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                {r.is_default && (
                  <span title="Default for this sport + body">
                    <Star className="ml-1 inline h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="capitalize">
                  {r.sport}
                </Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.sanctioning_body_id ? sbLabel(r, sbMap) : <em>house</em>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.rounds_championship ?? r.rounds_non_championship ?? "—"}
                {r.round_length_minutes != null && <> × {r.round_length_minutes}m</>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.scoring_mode?.replace(/_/g, " ") ?? "—"}
              </td>
            </tr>
          ))}
    </TableShell>
  );
}

function CardView({ rulesets, sbMap }: { rulesets: Ruleset[]; sbMap: Map<string, SbLite> }) {
  return (
    <CardGrid>
      {rulesets.map((r) => (
        <Link
          key={r.id}
          href={`/rules/${r.id}`}
          className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1 truncate font-heading font-medium">
                {r.name}
                {r.is_default && (
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {r.sanctioning_body_id ? sbLabel(r, sbMap) : "House"}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 capitalize">
              {r.sport}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Rounds
              </div>
              <div className="font-mono">
                {r.rounds_championship ?? r.rounds_non_championship ?? "—"}
                {r.round_length_minutes != null && ` × ${r.round_length_minutes}m`}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Scoring
              </div>
              <div className="truncate">{r.scoring_mode?.replace(/_/g, " ") ?? "—"}</div>
            </div>
          </div>
        </Link>
      ))}
    </CardGrid>
  );
}

function GridView({ rulesets, sbMap }: { rulesets: Ruleset[]; sbMap: Map<string, SbLite> }) {
  return (
    <TileGrid>
      {rulesets.map((r) => (
        <Link
          key={r.id}
          href={`/rules/${r.id}`}
          className="group flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/30"
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Scale className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="w-full truncate text-sm font-medium">
            {r.name}
            {r.is_default && (
              <Star className="ml-1 inline h-3 w-3 fill-amber-400 text-amber-400" />
            )}
          </div>
          <div className="w-full truncate text-[10px] capitalize text-muted-foreground">
            {r.sport} · {sbLabel(r, sbMap)}
          </div>
        </Link>
      ))}
    </TileGrid>
  );
}

function CompactView({ rulesets, sbMap }: { rulesets: Ruleset[]; sbMap: Map<string, SbLite> }) {
  return (
    <CompactList>
      {rulesets.map((r) => (
        <Link
          key={r.id}
          href={`/rules/${r.id}`}
          className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          <span className="w-16 shrink-0 text-xs capitalize text-muted-foreground">
            {r.sport}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {r.name}
            {r.is_default && (
              <Star className="ml-1 inline h-3 w-3 fill-amber-400 text-amber-400" />
            )}
          </span>
          <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {sbLabel(r, sbMap)}
          </span>
          <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
            {r.scoring_mode?.replace(/_/g, " ") ?? "—"}
          </span>
        </Link>
      ))}
    </CompactList>
  );
}

function KanbanView({ rulesets, sbMap }: { rulesets: Ruleset[]; sbMap: Map<string, SbLite> }) {
  const buckets = new Map<string, Ruleset[]>();
  for (const s of SPORTS) buckets.set(s, []);
  for (const r of rulesets) {
    if (!buckets.has(r.sport)) buckets.set(r.sport, []);
    buckets.get(r.sport)!.push(r);
  }
  const columns = Array.from(buckets.entries())
    .filter(([, arr]) => arr.length > 0)
    .map(([sport, items]) => ({
      key: sport,
      header: (
        <Badge variant="outline" className="capitalize">
          {sport}
        </Badge>
      ),
      items,
    }));

  return (
    <KanbanBoard
      columns={columns}
      renderItem={(r) => (
        <Link
          key={r.id}
          href={`/rules/${r.id}`}
          className="block rounded-lg border border-border bg-background p-2 text-xs hover:border-foreground/30"
        >
          <div className="flex items-center gap-1 truncate font-medium">
            {r.name}
            {r.is_default && (
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {sbLabel(r, sbMap)} · {r.rounds_championship ?? r.rounds_non_championship ?? "—"} rd
          </div>
        </Link>
      )}
    />
  );
}
