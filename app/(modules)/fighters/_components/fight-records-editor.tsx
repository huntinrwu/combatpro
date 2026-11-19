"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { saveFightRecords, type FightRecordEdit } from "../records-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FIGHT_CONFIDENCE,
  FIGHT_CONFIDENCE_META,
  FIGHT_OUTCOMES,
  type FightRecord,
} from "@/lib/db/types";

type Row = FightRecordEdit & {
  // Stable React key; new rows have no id yet.
  key: string;
  dirty: boolean;
  deleted: boolean;
};

const cell =
  "h-7 w-full rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

function toRow(r: FightRecord): Row {
  return {
    key: r.id,
    id: r.id,
    fight_date: r.fight_date,
    opponent_name: r.opponent_name,
    result: r.result,
    method: r.method ?? "",
    round_finished: r.round_finished != null ? String(r.round_finished) : "",
    is_pro: r.is_pro,
    event_name: r.event_name ?? "",
    confidence: r.confidence,
    dirty: false,
    deleted: false,
  };
}

// Staff-only spreadsheet-style editor for a fighter's bout-by-bout record.
// Edits, new rows and deletions are held locally and written in one save.
// The parent re-keys this component when the saved data changes, so local
// state always starts from what is in the database.
export function FightRecordsEditor({
  fighterId,
  records,
}: {
  fighterId: string;
  records: FightRecord[];
}) {
  const [rows, setRows] = useState<Row[]>(() => records.map(toRow));
  const [newCount, setNewCount] = useState(0);
  const [pending, startTransition] = useTransition();

  const changed = rows.filter((r) => (r.id ? r.dirty || r.deleted : !r.deleted));
  const hasChanges = changed.length > 0;

  function patch(key: string, fields: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...fields, dirty: true } : r)));
  }

  function addRow() {
    setNewCount((n) => n + 1);
    setRows((prev) => [
      {
        key: `new-${newCount}`,
        id: null,
        fight_date: "",
        opponent_name: "",
        result: "win",
        method: "",
        round_finished: "",
        is_pro: prev[0]?.is_pro ?? false,
        event_name: "",
        confidence: "verified",
        dirty: true,
        deleted: false,
      },
      ...prev,
    ]);
  }

  function toggleDelete(row: Row) {
    // An unsaved new row is simply dropped.
    if (!row.id) setRows((prev) => prev.filter((r) => r.key !== row.key));
    else setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, deleted: !r.deleted } : r)));
  }

  function save() {
    const live = rows.filter((r) => !r.deleted && (r.dirty || !r.id));
    const bad = live.find((r) => !r.fight_date || !r.opponent_name.trim());
    if (bad) {
      toast.error("Every fight needs a date and an opponent.");
      return;
    }
    const strip = ({ id, fight_date, opponent_name, result, method, round_finished, is_pro, event_name, confidence }: Row): FightRecordEdit => ({
      id,
      fight_date,
      opponent_name,
      result,
      method,
      round_finished,
      is_pro,
      event_name,
      confidence,
    });
    startTransition(async () => {
      try {
        await saveFightRecords({
          fighterId,
          upserts: live.map(strip),
          deletes: rows.filter((r) => r.deleted && r.id).map((r) => r.id!),
        });
        toast.success("Fight record saved");
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Type straight into the table, then save. Nothing is written until you save.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={pending}>
            <Plus className="h-3 w-3" />
            Add fight
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!hasChanges || pending}>
            {pending ? "Saving…" : hasChanges ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Saved"}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No fights yet. Use &quot;Add fight&quot; to start the record.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Opponent</th>
                <th className="px-2 py-2 font-medium">Result</th>
                <th className="px-2 py-2 font-medium">Method</th>
                <th className="px-2 py-2 font-medium">Rd</th>
                <th className="px-2 py-2 font-medium">Pro</th>
                <th className="px-2 py-2 font-medium">Event</th>
                <th className="px-2 py-2 font-medium">Confidence</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className={cn(
                    r.deleted && "opacity-50 [&_input]:line-through",
                    !r.deleted && r.dirty && "bg-amber-500/5",
                  )}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      aria-label="Fight date"
                      className={cn(cell, "w-32")}
                      value={r.fight_date}
                      disabled={r.deleted}
                      onChange={(e) => patch(r.key, { fight_date: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label="Opponent"
                      className={cn(cell, "min-w-36")}
                      value={r.opponent_name}
                      placeholder="Opponent name"
                      disabled={r.deleted}
                      onChange={(e) => patch(r.key, { opponent_name: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label="Result"
                      className={cn(cell, "w-24 capitalize")}
                      value={r.result}
                      disabled={r.deleted}
                      onChange={(e) => patch(r.key, { result: e.target.value as Row["result"] })}
                    >
                      {FIGHT_OUTCOMES.map((o) => (
                        <option key={o} value={o}>
                          {o.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label="Method"
                      className={cn(cell, "min-w-24")}
                      value={r.method}
                      placeholder="e.g. UD, TKO"
                      disabled={r.deleted}
                      onChange={(e) => patch(r.key, { method: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={1}
                      max={15}
                      aria-label="Round finished"
                      className={cn(cell, "w-14")}
                      value={r.round_finished}
                      disabled={r.deleted}
                      onChange={(e) => patch(r.key, { round_finished: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label="Professional bout"
                      checked={r.is_pro}
                      disabled={r.deleted}
                      onChange={(e) => patch(r.key, { is_pro: e.target.checked })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      aria-label="Event name"
                      className={cn(cell, "min-w-32")}
                      value={r.event_name}
                      placeholder="Event"
                      disabled={r.deleted}
                      onChange={(e) => patch(r.key, { event_name: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      aria-label="Confidence"
                      className={cn(cell, "w-36")}
                      value={r.confidence}
                      disabled={r.deleted}
                      onChange={(e) =>
                        patch(r.key, { confidence: e.target.value as Row["confidence"] })
                      }
                    >
                      {FIGHT_CONFIDENCE.map((c) => (
                        <option key={c} value={c}>
                          {FIGHT_CONFIDENCE_META[c].icon} {FIGHT_CONFIDENCE_META[c].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-1">
                      {r.id && !r.deleted && (
                        <Link
                          href={`/fighters/${fighterId}/records/${r.id}/edit`}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="More fields"
                          title="More fields (weight class, location, notes)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleDelete(r)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label={r.deleted ? "Keep this fight" : "Delete this fight"}
                        title={r.deleted ? "Undo delete" : "Delete (applies on save)"}
                      >
                        {r.deleted ? <Undo2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
