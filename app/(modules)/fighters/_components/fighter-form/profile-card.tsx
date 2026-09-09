import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { WeightClassSelect } from "@/components/weight-class-select";
import { SPORTS, STANCES, type Fighter } from "@/lib/db/types";
import { cmToFeetIn, cmToIn } from "@/lib/units";

function roundedIn(cm: number | null | undefined): string {
  const n = cmToIn(cm);
  return n == null ? "" : (Math.round(n * 4) / 4).toString();
}

export function ProfileCard({ defaults }: { defaults?: Partial<Fighter> }) {
  const heightParts = cmToFeetIn(defaults?.height_cm);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fight profile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <FormField label="Primary sport" htmlFor="primary_sport" required>
          <NativeSelect
            id="primary_sport"
            name="primary_sport"
            required
            defaultValue={defaults?.primary_sport ?? ""}
          >
            <option value="" disabled>Select sport…</option>
            {SPORTS.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Primary weight class"
          htmlFor="weight_class"
          hint="Pick from any sport — set more per-sport preferences on the fighter profile."
        >
          <WeightClassSelect
            id="weight_class"
            name="weight_class"
            defaultValue={defaults?.weight_class}
          />
        </FormField>
        <FormField
          label="Walking weight (lbs)"
          htmlFor="walking_weight_lbs"
          hint="Current off-camp weight. Updates the fighter's weight log."
        >
          <Input
            id="walking_weight_lbs"
            name="walking_weight_lbs"
            type="number"
            step="0.1"
            min={80}
            max={400}
            defaultValue={defaults?.walking_weight_lbs ?? ""}
          />
        </FormField>
        <FormField label="Stance" htmlFor="stance">
          <NativeSelect id="stance" name="stance" defaultValue={defaults?.stance ?? ""}>
            <option value="">—</option>
            {STANCES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Height"
          htmlFor="height_ft"
          hint="e.g. 5 ft 10 in. Displayed with meters/cm."
        >
          <div className="flex items-center gap-2">
            <Input
              id="height_ft"
              name="height_ft"
              type="number"
              step={1}
              min={3}
              max={8}
              placeholder="ft"
              defaultValue={heightParts?.feet ?? ""}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">ft</span>
            <Input
              id="height_in"
              name="height_in"
              type="number"
              step="0.5"
              min={0}
              max={11}
              placeholder="in"
              defaultValue={heightParts?.inches ?? ""}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">in</span>
          </div>
        </FormField>
        <FormField label="Reach (in)" htmlFor="reach_in">
          <Input
            id="reach_in"
            name="reach_in"
            type="number"
            step="0.25"
            min={40}
            max={100}
            defaultValue={roundedIn(defaults?.reach_cm)}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}
