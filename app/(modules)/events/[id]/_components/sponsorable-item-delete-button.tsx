"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeEventSponsorableItem } from "@/app/(modules)/sponsors/actions";
import { Button } from "@/components/ui/button";

type Props = {
  eventId: string;
  itemId: string;
  hasAssignments: boolean;
};

export function SponsorableItemActionButton({
  eventId,
  itemId,
  hasAssignments,
}: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (hasAssignments) {
      toast.error("Remove or reassign sponsors on this item first.");
      return;
    }
    if (!confirm("Delete this item from this event?")) return;

    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("id", itemId);

    startTransition(async () => {
      try {
        await removeEventSponsorableItem(fd);
        toast.success("Item deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete.");
      }
    });
  }

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label="Delete from this event"
      title="Delete from this event"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={handleClick}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
