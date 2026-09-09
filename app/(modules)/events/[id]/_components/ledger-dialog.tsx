"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addLedgerEntry } from "../ledger-actions";
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
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  REVENUE_CATEGORIES,
  type LedgerEntryType,
  type Vendor,
} from "@/lib/db/types";

type Props = {
  eventId: string;
  entryType: LedgerEntryType;
  vendors: Pick<Vendor, "id" | "name">[];
};

export function LedgerDialog({ eventId, entryType, vendors }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const isRevenue = entryType === "revenue";
  const cats = isRevenue ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
  const verb = isRevenue ? "revenue" : "expense";
  const title = isRevenue ? "Add revenue" : "Add expense";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        await addLedgerEntry(fd);
        toast.success(isRevenue ? "Revenue added" : "Expense added");
        form.reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant={isRevenue ? "default" : "outline"}>
            <Plus className="h-3.5 w-3.5" />
            Add {verb}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="entry_type" value={entryType} />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category" htmlFor="ld_cat" required>
              <NativeSelect id="ld_cat" name="category" required>
                {cats.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Amount ($)" htmlFor="ld_amt" required>
              <Input
                id="ld_amt"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                autoFocus
              />
            </FormField>
          </div>

          <FormField label="Label" htmlFor="ld_label" required>
            <Input
              id="ld_label"
              name="label"
              required
              placeholder={
                isRevenue
                  ? "e.g. VIP ringside — 42 tickets"
                  : "e.g. Venue rental — 4hrs"
              }
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={isRevenue ? "Received" : "Paid"} htmlFor="ld_when">
              <Input id="ld_when" name="received_at" type="date" />
            </FormField>
            <FormField label="Payment method" htmlFor="ld_pm">
              <NativeSelect id="ld_pm" name="payment_method" defaultValue="">
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>

          {!isRevenue && (
            <FormField
              label="Vendor"
              htmlFor="ld_vendor"
              hint={
                <>
                  Optional.{" "}
                  <Link
                    href="/vendors"
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    Manage vendors
                  </Link>
                </>
              }
            >
              <NativeSelect id="ld_vendor" name="vendor_id" defaultValue="">
                <option value="">— none —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Subcategory" htmlFor="ld_sub">
              <Input
                id="ld_sub"
                name="subcategory"
                placeholder={isRevenue ? "e.g. VIP tier" : "e.g. Rental, cleanup"}
              />
            </FormField>
            <FormField label="Reference" htmlFor="ld_ref">
              <Input id="ld_ref" name="reference" placeholder="Check #, invoice…" />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="ld_notes">
            <Textarea id="ld_notes" name="notes" rows={2} placeholder="Optional…" />
          </FormField>

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
              {pending ? "Saving…" : `Add ${verb}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
