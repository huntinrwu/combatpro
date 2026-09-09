"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  addEventSponsorableItem,
  updateEventSponsorableItem,
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
import { Textarea } from "@/components/ui/textarea";

type EditPayload = {
  key: string;
  label: string;
  hint: string | null;
};

type Props = {
  eventId: string;
  existing?: EditPayload;
};

export function SponsorableItemDialog({ eventId, existing }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = !!existing;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateEventSponsorableItem(fd);
          toast.success("Item updated");
        } else {
          await addEventSponsorableItem(fd);
          toast.success("Item added");
        }
        form.reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save item.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Edit item"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit sponsorable item" : "Add sponsorable item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <input type="hidden" name="event_id" value={eventId} />
          {isEdit && <input type="hidden" name="key" value={existing.key} />}

          <FormField label="Label" htmlFor="item_label" required>
            <Input
              id="item_label"
              name="label"
              required
              autoFocus
              defaultValue={existing?.label ?? ""}
              placeholder="e.g. Weigh-in backdrop"
            />
          </FormField>

          <FormField label="Hint" htmlFor="item_hint">
            <Textarea
              id="item_hint"
              name="hint"
              rows={2}
              defaultValue={existing?.hint ?? ""}
              placeholder="Optional — describes the placement for reference."
            />
          </FormField>

          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Changes apply to this event only."
              : "This item shows up alongside built-ins for this event only."}
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
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
