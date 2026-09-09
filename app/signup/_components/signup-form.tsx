"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { signupAction } from "../actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  PLATFORM_ROLES,
  ROLES_REQUIRING_GYM,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type PlatformRole,
} from "@/lib/auth/roles";

type Gym = { id: string; name: string; city: string | null; state: string | null };

export function SignupForm({ gyms }: { gyms: Gym[] }) {
  const [state, formAction] = useFormState(signupAction, { ok: true });
  const [selectedRoles, setSelectedRoles] = useState<Set<PlatformRole>>(new Set());
  const [gymChoice, setGymChoice] = useState<string>("");

  const needsGym = useMemo(
    () => [...selectedRoles].some((r) => ROLES_REQUIRING_GYM.includes(r)),
    [selectedRoles],
  );
  const showNewGymFields = needsGym && gymChoice === "__new__";

  function toggleRole(r: PlatformRole) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="full_name" required>
          <Input id="full_name" name="full_name" required autoComplete="name" />
        </FormField>
        <FormField label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          required
          hint="At least 8 characters."
          className="sm:col-span-2"
        >
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </FormField>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Roles you want to sign up as
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Pick every role that applies — you can hold more than one. Every role is reviewed
          by staff before it becomes active.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLATFORM_ROLES.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
            >
              <input
                type="checkbox"
                name="roles"
                value={role}
                checked={selectedRoles.has(role)}
                onChange={() => toggleRole(role)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="font-medium">{ROLE_LABELS[role]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {needsGym && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Which gym?</p>
            <p className="text-xs text-muted-foreground">
              Coach and gym owner roles must be linked to a gym. If yours isn&apos;t listed, add
              it — staff will review it alongside your role request.
            </p>
          </div>
          <FormField label="Gym" htmlFor="gym_choice" required>
            <NativeSelect
              id="gym_choice"
              name="gym_choice"
              required
              value={gymChoice}
              onChange={(e) => setGymChoice(e.target.value)}
            >
              <option value="">Select a gym…</option>
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.city ? ` — ${g.city}${g.state ? `, ${g.state}` : ""}` : ""}
                </option>
              ))}
              <option value="__new__">+ Add a new gym (staff will review)</option>
            </NativeSelect>
          </FormField>

          {showNewGymFields && (
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Gym name" htmlFor="new_gym_name" required className="sm:col-span-3">
                <Input id="new_gym_name" name="new_gym_name" required />
              </FormField>
              <FormField label="City" htmlFor="new_gym_city" className="sm:col-span-2">
                <Input id="new_gym_city" name="new_gym_city" />
              </FormField>
              <FormField label="State" htmlFor="new_gym_state">
                <Input id="new_gym_state" name="new_gym_state" maxLength={2} placeholder="FL" />
              </FormField>
            </div>
          )}
        </div>
      )}

      {state && !state.ok && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <SubmitButton />
      <p className="text-xs text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="underline hover:text-foreground">
          Log in
        </a>
        .
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}
