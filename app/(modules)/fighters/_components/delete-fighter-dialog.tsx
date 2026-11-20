"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteFighter } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Staff-only. Deleting is permanent, so the fighter's name has to be typed
// before the button unlocks, and the dialog spells out what goes with them.
export function DeleteFighterDialog({
  fighterId,
  fighterName,
  impact,
}: {
  fighterId: string;
  fighterName: string;
  impact: { events: number; openBouts: number; decidedBouts: number; fightRecords: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const blocked = impact.decidedBouts > 0;
  const matches = typed.trim().toLowerCase() === fighterName.trim().toLowerCase();

  function confirm() {
    const fd = new FormData();
    fd.set("fighter_id", fighterId);
    fd.set("confirm_name", typed);
    startTransition(async () => {
      try {
        await deleteFighter(fd);
        toast.success(`${fighterName} deleted`);
        router.push("/fighters");
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : "Could not delete.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {fighterName}?</DialogTitle>
        </DialogHeader>

        {blocked ? (
          <p className="text-sm text-muted-foreground">
            This fighter is on {impact.decidedBouts} bout{impact.decidedBouts === 1 ? "" : "s"} with
            a declared result. Deleting them would erase who fought in a finished bout, so it isn&apos;t
            allowed. Clear the result on those bouts first if this fighter really was entered by
            mistake.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This permanently removes the fighter and can&apos;t be undone. It also removes:
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>their profile, medical records and weight history</li>
              <li>
                {impact.fightRecords} fight record{impact.fightRecords === 1 ? "" : "s"}
              </li>
              <li>
                their place on {impact.events} event roster{impact.events === 1 ? "" : "s"}
              </li>
              {impact.openBouts > 0 && (
                <li className="font-medium text-foreground">
                  their corner on {impact.openBouts} upcoming bout
                  {impact.openBouts === 1 ? "" : "s"}, which will show as TBD
                </li>
              )}
            </ul>
            <label className="block text-xs text-muted-foreground">
              Type <span className="font-medium text-foreground">{fighterName}</span> to confirm
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="mt-1"
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          {!blocked && (
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={!matches || pending}
            >
              {pending ? "Deleting…" : "Delete fighter"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
