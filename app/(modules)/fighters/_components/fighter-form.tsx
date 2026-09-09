import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Fighter, Gym } from "@/lib/db/types";

import { ContactCard } from "./fighter-form/contact-card";
import { IdentityCard } from "./fighter-form/identity-card";
import { ProfileCard } from "./fighter-form/profile-card";
import { RecordCard } from "./fighter-form/record-card";

// Shared between /fighters/new and /fighters/[id]/edit.
export function FighterForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  gymList,
  hiddenFields,
}: {
  action: (fd: FormData) => void | Promise<void>;
  defaults?: Partial<Fighter>;
  submitLabel: string;
  cancelHref: string;
  gymList: Pick<Gym, "id" | "name">[];
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} className="space-y-6">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

      <IdentityCard defaults={defaults} gymList={gymList} />
      <ProfileCard defaults={defaults} />
      <RecordCard defaults={defaults} />
      <ContactCard defaults={defaults} />

      <div className="flex items-center gap-2">
        <Button type="submit">{submitLabel}</Button>
        <Button variant="ghost" render={<Link href={cancelHref}>Cancel</Link>} />
      </div>
    </form>
  );
}
