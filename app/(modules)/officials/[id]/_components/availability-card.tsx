import { CalendarX, Trash2 } from "lucide-react";

import { deleteBlock, upsertBlock } from "../availability-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AVAILABILITY_STATUSES,
  type OfficialAvailability,
} from "@/lib/db/types";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AvailabilityCard({
  officialId,
  blocks,
}: {
  officialId: string;
  blocks: OfficialAvailability[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const future = blocks
    .filter((b) => b.block_date >= today)
    .sort((a, b) => a.block_date.localeCompare(b.block_date));
  const past = blocks.filter((b) => b.block_date < today);

  return (
    <div className="space-y-4">
      <form
        action={upsertBlock}
        className="grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"
      >
        <input type="hidden" name="official_id" value={officialId} />
        <FormField label="Date" htmlFor="block_date">
          <Input id="block_date" name="block_date" type="date" required />
        </FormField>
        <FormField label="Status" htmlFor="block_status">
          <NativeSelect id="block_status" name="status" defaultValue="unavailable">
            {AVAILABILITY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Notes" htmlFor="block_notes">
          <Input id="block_notes" name="notes" placeholder="Vacation, other event…" />
        </FormField>
        <Button type="submit" size="sm">
          Block date
        </Button>
      </form>

      {future.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Upcoming blocks ({future.length})
          </div>
          <ul className="space-y-1">
            {future.map((b) => (
              <BlockRow key={b.id} officialId={officialId} block={b} />
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <details className="rounded border border-border/60 p-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Past blocks ({past.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {past.map((b) => (
              <BlockRow key={b.id} officialId={officialId} block={b} muted />
            ))}
          </ul>
        </details>
      )}

      {blocks.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No blocked dates — official is available on any date.
        </p>
      )}
    </div>
  );
}

function BlockRow({
  officialId,
  block,
  muted = false,
}: {
  officialId: string;
  block: OfficialAvailability;
  muted?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm ${
        muted ? "text-muted-foreground" : ""
      }`}
    >
      <CalendarX
        className={`h-4 w-4 ${
          block.status === "unavailable"
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400"
        }`}
      />
      <div className="flex-1">
        <div className="font-medium">{fmtDate(block.block_date)}</div>
        {block.notes && <div className="text-xs text-muted-foreground">{block.notes}</div>}
      </div>
      <Badge
        variant="outline"
        className={
          block.status === "unavailable"
            ? "border-red-500/40 text-red-700 dark:text-red-300"
            : "border-amber-500/40 text-amber-700 dark:text-amber-300"
        }
      >
        {block.status}
      </Badge>
      <form action={deleteBlock}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="official_id" value={officialId} />
        <Button type="submit" size="icon-sm" variant="ghost" aria-label="Unblock">
          <Trash2 className="h-3 w-3" />
        </Button>
      </form>
    </li>
  );
}
