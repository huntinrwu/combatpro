"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { setEventSponsorTarget } from "@/app/(modules)/sponsors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtMoney, type SponsorItemKey } from "@/lib/db/types";

type Props = {
  eventId: string;
  itemType: SponsorItemKey;
  currentTarget: number;
};

export function SponsorTargetEditor({ eventId, itemType, currentTarget }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentTarget || ""));
  const [pending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("item_type", itemType);
    fd.set("target_value", value.trim() || "0");
    startTransition(async () => {
      try {
        await setEventSponsorTarget(fd);
        toast.success("Target saved");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save target.");
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
        {currentTarget > 0 ? (
          <span className="font-mono">Target {fmtMoney(currentTarget)}</span>
        ) : (
          <span>Set target</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            setEditing(false);
            setValue(String(currentTarget || ""));
          }
        }}
        placeholder="0.00"
        autoFocus
        className="h-7 w-24 text-xs"
        disabled={pending}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Save target"
        onClick={save}
        disabled={pending}
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Cancel"
        onClick={() => {
          setEditing(false);
          setValue(String(currentTarget || ""));
        }}
        disabled={pending}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
