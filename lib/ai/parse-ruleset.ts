import Anthropic from "@anthropic-ai/sdk";

// Structured fields we ask the model to pull out of a rules PDF. Matches the
// shape of public.rulesets (minus identity fields — those come from the form).
export type ExtractedRuleset = {
  rounds_championship: number | null;
  rounds_non_championship: number | null;
  round_length_minutes: number | null;
  rest_length_seconds: number | null;
  scoring_mode: "10_point_must" | "points_based" | null;
  weight_allowance_lbs: number | null;
  glove_specs: string | null;
  wraps_spec: string | null;
  three_knockdown_rule: boolean;
  standing_eight_count: boolean;
  open_scoring: boolean;
  protective_gear: string | null;
  notes: string | null;
};

const SYSTEM = `You extract structured combat sports rulesets from PDF documents.

Return ONLY a single JSON object matching the required schema. No commentary,
no markdown fences. If a field cannot be determined from the document, use
null (or false for booleans that clearly aren't mentioned). Do not invent
values — if the PDF is silent on a rule, leave it null/false.

scoring_mode must be exactly "10_point_must" or "points_based" (or null).
Numeric fields must be numbers, not strings.`;

const USER_INSTRUCTION = `Extract the ruleset from this document.

Schema (all keys required, values may be null):
{
  "rounds_championship": integer | null,
  "rounds_non_championship": integer | null,
  "round_length_minutes": number | null,
  "rest_length_seconds": integer | null,
  "scoring_mode": "10_point_must" | "points_based" | null,
  "weight_allowance_lbs": number | null,
  "glove_specs": string | null,
  "wraps_spec": string | null,
  "three_knockdown_rule": boolean,
  "standing_eight_count": boolean,
  "open_scoring": boolean,
  "protective_gear": string | null,
  "notes": string | null
}

The "notes" field should capture anything material that doesn't fit elsewhere
(fouls, medical requirements, specific stoppage conditions, etc.) — a short
paragraph, not the whole document.`;

// Returns null when parsing is disabled (no ANTHROPIC_API_KEY on the server).
// Callers should treat null as "skip silently" — not as an error. Throws only
// for actual runtime failures (API error, malformed response).
export async function extractRulesetFromPdf(
  pdfBuffer: Buffer,
  sport: string,
): Promise<ExtractedRuleset | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const pdfBase64 = pdfBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `${USER_INSTRUCTION}\n\nSport context: ${sport}`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  // Strip accidental markdown fences.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Model returned non-JSON output: ${cleaned.slice(0, 200)}`);
  }

  return normalize(parsed);
}

function normalize(raw: unknown): ExtractedRuleset {
  const r = (raw ?? {}) as Record<string, unknown>;
  const scoring = r.scoring_mode;
  return {
    rounds_championship: numOrNull(r.rounds_championship),
    rounds_non_championship: numOrNull(r.rounds_non_championship),
    round_length_minutes: numOrNull(r.round_length_minutes),
    rest_length_seconds: numOrNull(r.rest_length_seconds),
    scoring_mode:
      scoring === "10_point_must" || scoring === "points_based" ? scoring : null,
    weight_allowance_lbs: numOrNull(r.weight_allowance_lbs),
    glove_specs: strOrNull(r.glove_specs),
    wraps_spec: strOrNull(r.wraps_spec),
    three_knockdown_rule: r.three_knockdown_rule === true,
    standing_eight_count: r.standing_eight_count === true,
    open_scoring: r.open_scoring === true,
    protective_gear: strOrNull(r.protective_gear),
    notes: strOrNull(r.notes),
  };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}
