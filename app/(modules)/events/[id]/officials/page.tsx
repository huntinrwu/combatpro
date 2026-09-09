import { notFound } from "next/navigation";
import { UserPlus, X } from "lucide-react";

import { assignEventOfficial, unassignEventOfficial } from "./actions";
import { loadEventDetail } from "../_lib/event-detail";
import { db } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { canEditEvent } from "@/lib/auth/roles";
import { OFFICIAL_ROLE_ORDER } from "@/lib/ui-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import {
  EVENT_ROLES,
  EVENT_ROLE_LABELS,
  type EventOfficial,
  type EventRole,
  type Official,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

type OfficialLite = Pick<Official, "id" | "full_name" | "roles" | "home_state">;

type EnrichedRosterRow = EventOfficial & {
  official: OfficialLite | null;
};

export default async function EventOfficialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadEventDetail(id);
  if (!detail) notFound();
  const { event } = detail;

  const session = await getSessionUser();
  const canEdit = session ? canEditEvent(event, session) : false;

  const supabase = db();

  const [{ data: roster }, { data: allOfficials }, { data: unavailable }] =
    await Promise.all([
      supabase
        .from("event_officials")
        .select("*")
        .eq("event_id", id)
        .order("created_at"),
      supabase
        .from("officials")
        .select("id, full_name, roles, home_state")
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("official_availability")
        .select("official_id, status, notes")
        .eq("block_date", event.event_date),
    ]);

  const officialMap = new Map<string, OfficialLite>();
  for (const o of (allOfficials ?? []) as OfficialLite[]) {
    officialMap.set(o.id, o);
  }

  const enriched: EnrichedRosterRow[] = ((roster ?? []) as EventOfficial[])
    .map((a) => ({ ...a, official: officialMap.get(a.official_id) ?? null }))
    .sort(
      (a, b) =>
        (OFFICIAL_ROLE_ORDER[a.event_role] ?? 99) -
          (OFFICIAL_ROLE_ORDER[b.event_role] ?? 99) ||
        (a.official?.full_name ?? "").localeCompare(b.official?.full_name ?? ""),
    );

  const grouped = new Map<EventRole, EnrichedRosterRow[]>();
  for (const row of enriched) {
    const arr = grouped.get(row.event_role) ?? [];
    arr.push(row);
    grouped.set(row.event_role, arr);
  }

  // Same-official-same-role pairs are unique. We still allow one official to
  // hold multiple roles, so filter the assign picker to hide only exact dupes.
  const takenPairs = new Set(
    enriched.map((r) => `${r.official_id}:${r.event_role}`),
  );

  const unavailableMap = new Map<
    string,
    { status: string; notes: string | null }
  >();
  for (const b of (unavailable ?? []) as {
    official_id: string;
    status: string;
    notes: string | null;
  }[]) {
    unavailableMap.set(b.official_id, { status: b.status, notes: b.notes });
  }

  const pickerOfficials = (allOfficials ?? []) as OfficialLite[];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Event roster ({enriched.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enriched.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No officials assigned to this event yet.
                {canEdit ? " Use the panel on the right to build the roster." : ""}
              </p>
            ) : (
              <div className="space-y-4">
                {EVENT_ROLES.filter((r) => grouped.has(r)).map((role) => (
                  <div key={role}>
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      {EVENT_ROLE_LABELS[role]}
                      <span className="ml-2 text-muted-foreground/60">
                        {grouped.get(role)!.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-border rounded-md border border-border/70">
                      {grouped.get(role)!.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {r.official?.full_name ?? "(missing)"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.official?.home_state ?? "—"}
                              {r.official &&
                                r.official.roles.length > 0 &&
                                !r.official.roles.includes(role as never) && (
                                  <> · usually {r.official.roles.join(", ")}</>
                                )}
                            </div>
                          </div>
                          {canEdit && (
                            <form action={unassignEventOfficial}>
                              <input
                                type="hidden"
                                name="assignment_id"
                                value={r.id}
                              />
                              <input
                                type="hidden"
                                name="event_id"
                                value={event.id}
                              />
                              <Button
                                type="submit"
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Remove from roster"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Assign official
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pickerOfficials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active officials in the registry.
              </p>
            ) : (
              <form action={assignEventOfficial} className="space-y-3">
                <input type="hidden" name="event_id" value={event.id} />
                <FormField label="Official" htmlFor="official_id" required>
                  <NativeSelect
                    id="official_id"
                    name="official_id"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {pickerOfficials.map((o) => {
                      const block = unavailableMap.get(o.id);
                      const prefix =
                        block?.status === "unavailable"
                          ? "⛔ UNAVAILABLE — "
                          : block?.status === "tentative"
                            ? "⚠️ tentative — "
                            : "";
                      return (
                        <option key={o.id} value={o.id}>
                          {prefix}
                          {o.full_name} (
                          {o.roles.join(", ") || "no role"})
                        </option>
                      );
                    })}
                  </NativeSelect>
                </FormField>
                <FormField label="Event role" htmlFor="event_role" required>
                  <NativeSelect
                    id="event_role"
                    name="event_role"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose role…
                    </option>
                    {EVENT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {EVENT_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <p className="text-xs text-muted-foreground">
                  One official can hold multiple event roles (e.g. head official
                  + judge). Duplicate role assignments are blocked at the DB.
                </p>
                <Button type="submit" size="sm">
                  Add to roster
                </Button>
                {takenPairs.size > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {takenPairs.size} role assignment
                    {takenPairs.size === 1 ? "" : "s"} on the roster so far.
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
