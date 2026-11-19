"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";

import { registerForEvent, type RegisterResult } from "../actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";

const INITIAL: RegisterResult = { status: "idle" };

export function RegisterForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState(registerForEvent, INITIAL);

  if (state.status === "done") {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-2 font-medium">
          {state.name ? `Thanks, ${state.name}.` : "Thanks."} You&apos;re on the list.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          The event organizers will be in touch to confirm your spot.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {/* Honeypot — hidden from people, tempting to bots. */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormField label="Full name" htmlFor="reg_name" required>
        <Input id="reg_name" name="full_name" required maxLength={80} autoComplete="name" autoFocus />
      </FormField>
      <FormField
        label="Phone or email"
        htmlFor="reg_contact"
        hint="Optional. So the organizers can reach you."
      >
        <Input id="reg_contact" name="contact" maxLength={120} />
      </FormField>
      {state.status === "error" && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Submitting…" : "Register"}
    </Button>
  );
}
