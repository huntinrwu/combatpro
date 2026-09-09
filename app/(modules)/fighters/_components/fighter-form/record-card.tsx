import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import type { Fighter } from "@/lib/db/types";

export function RecordCard({ defaults }: { defaults?: Partial<Fighter> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 grid-cols-3 md:grid-cols-6">
        <FormField label="Pro W" htmlFor="pro_wins">
          <Input id="pro_wins" name="pro_wins" type="number" min={0} defaultValue={defaults?.pro_wins ?? 0} />
        </FormField>
        <FormField label="Pro L" htmlFor="pro_losses">
          <Input id="pro_losses" name="pro_losses" type="number" min={0} defaultValue={defaults?.pro_losses ?? 0} />
        </FormField>
        <FormField label="Pro D" htmlFor="pro_draws">
          <Input id="pro_draws" name="pro_draws" type="number" min={0} defaultValue={defaults?.pro_draws ?? 0} />
        </FormField>
        <FormField label="Am W" htmlFor="am_wins">
          <Input id="am_wins" name="am_wins" type="number" min={0} defaultValue={defaults?.am_wins ?? 0} />
        </FormField>
        <FormField label="Am L" htmlFor="am_losses">
          <Input id="am_losses" name="am_losses" type="number" min={0} defaultValue={defaults?.am_losses ?? 0} />
        </FormField>
        <FormField label="Am D" htmlFor="am_draws">
          <Input id="am_draws" name="am_draws" type="number" min={0} defaultValue={defaults?.am_draws ?? 0} />
        </FormField>
      </CardContent>
    </Card>
  );
}
