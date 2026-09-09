import Link from "next/link";
import { BookOpenText } from "lucide-react";

import { assignBoutRuleset } from "../../../../../rules/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import type { Ruleset } from "@/lib/db/types";

type RulesetOption = Pick<Ruleset, "id" | "name" | "sport" | "sanctioning_body_id" | "is_default">;

export function RulesetCard({
  boutId,
  eventId,
  currentRulesetId,
  currentRuleset,
  rulesetList,
}: {
  boutId: string;
  eventId: string;
  currentRulesetId: string | null;
  currentRuleset: RulesetOption | null;
  rulesetList: RulesetOption[];
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenText className="h-4 w-4" />
          Ruleset
          {currentRuleset && (
            <Link
              href={`/rules/${currentRuleset.id}`}
              className="ml-2 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
            >
              {currentRuleset.name} →
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={assignBoutRuleset} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="bout_id" value={boutId} />
          <input type="hidden" name="event_id" value={eventId} />
          <NativeSelect
            name="ruleset_id"
            defaultValue={currentRulesetId ?? "__none__"}
            className="min-w-[16rem] flex-1"
          >
            <option value="__none__">— No ruleset (use bout fields only) —</option>
            {rulesetList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.sport}
                {r.is_default ? " · default" : ""})
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" variant="secondary">
            Save
          </Button>
          {rulesetList.length === 0 && (
            <Link href="/rules/new" className="text-xs text-muted-foreground underline">
              Create one
            </Link>
          )}
        </form>
        {currentRuleset && (
          <p className="mt-2 text-xs text-muted-foreground">
            Ruleset details render on the bout agreement PDF.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
