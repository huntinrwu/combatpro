"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { MediaField } from "@/components/forms/media-field";
import { Textarea } from "@/components/ui/textarea";
import { OFFICIAL_ROLES, SPORTS, type Official, type OfficialRole } from "@/lib/db/types";

// Well-known certification / sanctioning bodies. Not exhaustive — the dialog
// also accepts free-form entries so obscure or new orgs still fit.
const KNOWN_CERTS = [
  "WBC",
  "WBA",
  "IBF",
  "WBO",
  "IBO",
  "WBF",
  "ABC",
  "USA Boxing",
  "ISKA",
  "IKF",
  "WKA",
  "WAKO",
  "FSBC",
  "CSAC",
  "NSAC",
  "TDLR",
  "TBA",
  "IMMAF",
  "UFC",
  "Bellator",
  "ONE",
];

export function OfficialForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  hiddenFields,
}: {
  action: (fd: FormData) => void | Promise<void>;
  defaults?: Partial<Official>;
  submitLabel: string;
  cancelHref: string;
  hiddenFields?: Record<string, string>;
}) {
  const [roles, setRoles] = useState<OfficialRole[]>(defaults?.roles ?? []);
  const [sports, setSports] = useState<string[]>(defaults?.sports ?? []);
  const [certs, setCerts] = useState<string[]>(defaults?.certifications ?? []);
  const [isActive, setIsActive] = useState<boolean>(defaults?.is_active ?? true);

  return (
    <form action={action} className="space-y-6">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

      {/* Selections serialized as repeated fields so FormData.getAll() sees them. */}
      {roles.map((r) => (
        <input key={r} type="hidden" name="roles" value={r} />
      ))}
      {sports.map((s) => (
        <input key={s} type="hidden" name="sports" value={s} />
      ))}
      {certs.map((c) => (
        <input key={c} type="hidden" name="certifications" value={c} />
      ))}
      <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Full name" htmlFor="full_name" required>
            <Input
              id="full_name"
              name="full_name"
              required
              autoFocus
              defaultValue={defaults?.full_name ?? ""}
            />
          </FormField>
          <FormField label="Home state" htmlFor="home_state" hint="2-letter USPS.">
            <Input
              id="home_state"
              name="home_state"
              maxLength={2}
              placeholder="FL"
              defaultValue={defaults?.home_state ?? ""}
            />
          </FormField>
          <FormField label="Photo" htmlFor="photo_url" className="md:col-span-2">
            <MediaField
              id="photo_url"
              name="photo_url"
              kind="official-photo"
              aspect="round"
              defaultValue={defaults?.photo_url}
              label={{ empty: "Drop a headshot or click to upload" }}
            />
          </FormField>

          <FormField
            label="Roles"
            required
            hint="Select every role this official is credentialed for."
            className="md:col-span-2"
          >
            <div className="flex flex-wrap gap-2 rounded-lg border border-input bg-background p-3">
              {OFFICIAL_ROLES.map((r) => {
                const on = roles.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex cursor-pointer select-none items-center gap-2 rounded-md border px-3 py-1.5 text-sm capitalize transition ${
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) =>
                        setRoles((prev) =>
                          e.target.checked
                            ? [...prev, r]
                            : prev.filter((x) => x !== r),
                        )
                      }
                    />
                    {on && <Check className="h-3.5 w-3.5" />}
                    {r}
                  </label>
                );
              })}
            </div>
            {roles.length === 0 && (
              <p className="text-xs text-destructive">Pick at least one role.</p>
            )}
          </FormField>

          <FormField label="Active since" htmlFor="active_since" hint="Date of first event worked.">
            <Input
              id="active_since"
              name="active_since"
              type="date"
              defaultValue={defaults?.active_since ?? ""}
            />
          </FormField>
          <FormField label="Status" hint="Toggle off when the official retires or stops working.">
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <span
                className={`inline-flex h-5 w-9 items-center rounded-full transition ${
                  isActive ? "bg-emerald-500" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-background shadow transition ${
                    isActive ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="font-medium">{isActive ? "Active" : "Not active"}</span>
            </label>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sports &amp; certifications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField label="Sports" hint="Click to open the picker.">
            <ChipsPicker
              title="Pick sports"
              selected={sports}
              onChange={setSports}
              options={[...SPORTS]}
              emptyLabel="No sports selected"
              capitalize
            />
          </FormField>
          <FormField
            label="Certifications"
            hint="Sanctioning / credentialing bodies. Add any not listed."
          >
            <ChipsPicker
              title="Pick certifications"
              selected={certs}
              onChange={setCerts}
              options={KNOWN_CERTS}
              emptyLabel="No certifications selected"
              allowCustom
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact &amp; notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Email" htmlFor="contact_email">
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={defaults?.contact_email ?? ""}
            />
          </FormField>
          <FormField label="Phone" htmlFor="contact_phone">
            <Input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              defaultValue={defaults?.contact_phone ?? ""}
            />
          </FormField>
          <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
            <Textarea id="notes" name="notes" rows={3} defaultValue={defaults?.notes ?? ""} />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={roles.length === 0}>
          {submitLabel}
        </Button>
        <Button variant="ghost" render={<Link href={cancelHref}>Cancel</Link>} />
      </div>
    </form>
  );
}

function ChipsPicker({
  title,
  selected,
  onChange,
  options,
  emptyLabel,
  allowCustom = false,
  capitalize = false,
}: {
  title: string;
  selected: string[];
  onChange: (next: string[]) => void;
  options: string[];
  emptyLabel: string;
  allowCustom?: boolean;
  capitalize?: boolean;
}) {
  const [customDraft, setCustomDraft] = useState("");
  const merged = Array.from(new Set([...options, ...selected]));

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const remove = (value: string) => onChange(selected.filter((v) => v !== value));

  const addCustom = () => {
    const trimmed = customDraft.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) onChange([...selected, trimmed]);
    setCustomDraft("");
  };

  return (
    <div className="rounded-lg border border-input bg-background p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 && (
          <span className="px-1 text-xs text-muted-foreground">{emptyLabel}</span>
        )}
        {selected.map((v) => (
          <Badge
            key={v}
            variant="secondary"
            className={`gap-1 py-1 ${capitalize ? "capitalize" : ""}`}
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Dialog>
          <DialogTrigger
            render={
              <Button type="button" size="sm" variant="outline" className="ml-auto">
                <Plus className="h-3.5 w-3.5" />
                Edit
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="max-h-72 overflow-y-auto rounded-md border border-border/60 p-2">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {merged.map((opt) => {
                  const on = selected.includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`flex cursor-pointer select-none items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition ${
                        capitalize ? "capitalize" : ""
                      } ${
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => toggle(opt)}
                      />
                      {on ? <Check className="h-3 w-3" /> : <span className="h-3 w-3" />}
                      <span className="truncate">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {allowCustom && (
              <div className="flex gap-2">
                <Input
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  placeholder="Add custom…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={addCustom}>
                  Add
                </Button>
              </div>
            )}
            <DialogFooter>
              <DialogClose render={<Button size="sm">Done</Button>} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
