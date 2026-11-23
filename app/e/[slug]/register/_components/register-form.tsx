"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";

import { registerForEvent, type RegisterResult } from "../actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const INITIAL: RegisterResult = { status: "idle" };

export function RegisterForm({
  slug,
  weightClasses,
}: {
  slug: string;
  // Class names for this event's sport; empty when the sport has no table.
  weightClasses: string[];
}) {
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
      <FormField label="Email" htmlFor="reg_email" required>
        <Input
          id="reg_email"
          name="email"
          type="email"
          required
          maxLength={120}
          autoComplete="email"
        />
      </FormField>
      <FormField label="Phone" htmlFor="reg_phone" hint="Optional.">
        <Input id="reg_phone" name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date of birth" htmlFor="reg_dob" required>
          <Input id="reg_dob" name="date_of_birth" type="date" required autoComplete="bday" />
        </FormField>
        <FormField label="Gender" htmlFor="reg_gender" required>
          <NativeSelect id="reg_gender" name="gender" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </NativeSelect>
        </FormField>
      </div>
      <FormField
        label="Gym"
        htmlFor="reg_gym"
        required
        hint='Write "Independent" if you train without a gym.'
      >
        <Input id="reg_gym" name="gym_name" required maxLength={80} />
      </FormField>
      <FormField label="Desired weight class" htmlFor="reg_class" required>
        {weightClasses.length > 0 ? (
          <NativeSelect id="reg_class" name="weight_class" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {weightClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Input id="reg_class" name="weight_class" required maxLength={60} placeholder="e.g. 155 lbs" />
        )}
      </FormField>
      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground">
          Fight record<span className="ml-0.5 text-destructive">*</span>
        </legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {(
            [
              ["wins", "Wins"],
              ["losses", "Losses"],
              ["draws", "Draws"],
            ] as const
          ).map(([name, label]) => (
            <label key={name} className="text-xs text-muted-foreground">
              {label}
              <Input
                name={name}
                type="number"
                inputMode="numeric"
                min={0}
                max={500}
                step={1}
                required
                defaultValue={0}
                className="mt-1"
              />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground/80">Leave at 0 if this is your first fight.</p>
      </fieldset>
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
