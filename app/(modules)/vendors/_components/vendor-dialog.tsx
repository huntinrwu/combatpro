"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addVendor } from "../actions";
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
import { EXPENSE_CATEGORIES } from "@/lib/db/types";

export function VendorDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        await addVendor(fd);
        toast.success("Vendor added");
        form.reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add vendor.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            Add vendor
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <FormField label="Name" htmlFor="vendor_name" required>
            <Input
              id="vendor_name"
              name="name"
              required
              autoFocus
              placeholder="e.g. Kissimmee Civic Center"
            />
          </FormField>
          <FormField label="Default category" htmlFor="vendor_cat">
            <NativeSelect id="vendor_cat" name="default_category" defaultValue="">
              <option value="">—</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact name" htmlFor="vendor_contact">
              <Input id="vendor_contact" name="contact_name" />
            </FormField>
            <FormField label="Phone" htmlFor="vendor_phone">
              <Input id="vendor_phone" name="contact_phone" type="tel" />
            </FormField>
          </div>
          <FormField label="Email" htmlFor="vendor_email">
            <Input id="vendor_email" name="contact_email" type="email" />
          </FormField>
          <FormField label="Website" htmlFor="vendor_web">
            <Input id="vendor_web" name="website" type="url" placeholder="https://…" />
          </FormField>
          <FormField label="Address" htmlFor="vendor_addr">
            <Input id="vendor_addr" name="address" />
          </FormField>
          <FormField label="Notes" htmlFor="vendor_notes">
            <Textarea id="vendor_notes" name="notes" rows={2} />
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
              {pending ? "Saving…" : "Add vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
