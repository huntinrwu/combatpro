"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  addEventSponsor,
  updateEventSponsor,
} from "@/app/(modules)/sponsors/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  SPONSOR_TIERS,
  type EventSponsor,
  type Sponsor,
  type SponsorItemKey,
} from "@/lib/db/types";

type AddProps = {
  eventId: string;
  sponsors: Pick<Sponsor, "id" | "name">[];
  itemType: SponsorItemKey;
  itemLabel: string;
  existing?: undefined;
  triggerLabel?: string;
  size?: "sm" | "default";
};

type EditProps = {
  eventId: string;
  sponsors: Pick<Sponsor, "id" | "name">[];
  itemType?: never;
  itemLabel?: never;
  existing: EventSponsor;
  triggerLabel?: string;
  size?: "sm" | "default";
};

type Props = AddProps | EditProps;

export function SponsorDialog(props: Props) {
  const { eventId, sponsors, existing, size = "sm" } = props;
  const isEdit = !!existing;
  const itemType = (isEdit ? existing.item_type : props.itemType) as SponsorItemKey;
  const isLegacyCustom = isEdit && existing.item_type === "custom";

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateEventSponsor(fd);
          toast.success("Sponsor updated");
        } else {
          await addEventSponsor(fd);
          toast.success("Sponsor assigned");
          form.reset();
        }
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (!isEdit && sponsors.length === 0) {
    return (
      <Button size={size} variant="outline" render={<Link href="/sponsors/new" />}>
        <Plus className="h-3.5 w-3.5" />
        Add a sponsor first
      </Button>
    );
  }

  const paidDefault = existing?.paid_at ? existing.paid_at.slice(0, 10) : "";
  const headline = isEdit
    ? "Edit sponsor assignment"
    : `Assign sponsor — ${props.itemLabel}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Edit assignment"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          ) : (
            <Button size={size} variant="outline">
              <Plus className="h-3.5 w-3.5" />
              {props.triggerLabel ?? "Assign"}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="item_type" value={itemType} />
          {isEdit && <input type="hidden" name="id" value={existing.id} />}
          {isLegacyCustom && (
            <input
              type="hidden"
              name="slot_label"
              value={existing.slot_label ?? ""}
            />
          )}

          <FormField label="Sponsor" htmlFor="sp_id" required>
            <NativeSelect
              id="sp_id"
              name="sponsor_id"
              required
              autoFocus
              defaultValue={existing?.sponsor_id ?? ""}
            >
              {!isEdit && <option value="">— pick sponsor —</option>}
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField label="Tier" htmlFor="sp_tier" required>
            <NativeSelect
              id="sp_tier"
              name="tier"
              required
              defaultValue={existing?.tier ?? "associate"}
            >
              {SPONSOR_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contract value ($)" htmlFor="sp_amt">
              <Input
                id="sp_amt"
                name="contract_value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  existing ? String(existing.contract_value ?? 0) : "0"
                }
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Paid on" htmlFor="sp_paid">
              <Input
                id="sp_paid"
                name="paid_at"
                type="date"
                defaultValue={paidDefault}
              />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="sp_notes">
            <Textarea
              id="sp_notes"
              name="notes"
              rows={2}
              defaultValue={existing?.notes ?? ""}
              placeholder="Optional…"
            />
          </FormField>

          <p className="text-xs text-muted-foreground">
            A contract value auto-creates a matching{" "}
            <span className="font-mono">sponsorship</span> revenue entry in the
            event ledger.
          </p>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Assign sponsor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
