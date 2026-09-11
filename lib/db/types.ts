export type Person = {
  id: string;
  person_no: number;
  full_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  hometown: string | null;
  nationality: string | null;
  auth_user_id: string | null;
  notes: string | null;
  merged_into_person_id: string | null;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Commission = {
  id: string;
  name: string;
  abbreviation: string;
  jurisdiction: string;
  country: string;
  state: string | null;
  website: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
};

export type SanctioningBodyStatus = "approved" | "pending" | "rejected";

export type SanctioningBody = {
  id: string;
  name: string;
  abbreviation: string;
  sports: string[];
  scope: string;
  headquarters: string | null;
  website: string | null;
  contact_email: string | null;
  status: SanctioningBodyStatus;
  submitted_by_email: string | null;
  submitted_at: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
};

export type Fighter = {
  id: string;
  full_name: string;
  nickname: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  gym: string | null;
  gym_id: string | null;
  hometown: string | null;
  stance: string | null;
  height_cm: number | null;
  reach_cm: number | null;
  weight_class: string | null;
  walking_weight_lbs: number | string | null;
  walking_weight_updated_at: string | null;
  primary_sport: string;
  pro_wins: number;
  pro_losses: number;
  pro_draws: number;
  am_wins: number;
  am_losses: number;
  am_draws: number;
  photo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  licenses: string | null;
  notes: string | null;
  person_id: string | null;
  created_at: string;
};

export type OfficialSbStatus = "active" | "inactive" | "suspended";

export type OfficialSanctioningBody = {
  id: string;
  official_id: string;
  sanctioning_body_id: string;
  status: OfficialSbStatus;
  level: string | null;
  certified_since: string | null;
  expires_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const OFFICIAL_SB_STATUSES: OfficialSbStatus[] = [
  "active",
  "inactive",
  "suspended",
];

export type OfficialRole = "referee" | "judge" | "doctor" | "timekeeper" | "inspector";

// Superset used on the event roster. Officials assigned to an event can hold
// event-only roles like jury or head_official even if they aren't in their
// personal `roles` array — those are org roles, not personal skills.
export type EventRole = OfficialRole | "jury" | "head_official";

export type Official = {
  id: string;
  full_name: string;
  roles: OfficialRole[];
  sports: string[];
  home_state: string | null;
  active_since: string | null;
  is_active: boolean;
  photo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  certifications: string[];
  notes: string | null;
  person_id: string | null;
  created_at: string;
};

export type EventStatus = "draft" | "scheduled" | "complete" | "canceled";

export type EventRow = {
  id: string;
  name: string;
  event_date: string;
  venue: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  promoter: string | null;
  promotion_id: string | null;
  primary_sport: string;
  commission_id: string | null;
  sanctioning_body_id: string | null;
  status: EventStatus;
  current_bout_id: string | null;
  slug: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type PromotionStatus = "approved" | "pending" | "rejected";

export const PROMOTION_SCOPES = ["local", "regional", "national", "international"] as const;
export type PromotionScope = (typeof PROMOTION_SCOPES)[number];

export type Promotion = {
  id: string;
  name: string;
  abbreviation: string | null;
  sports: string[];
  scope: PromotionScope;
  home_state: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  founded_year: number | null;
  logo_url: string | null;
  tenant_org_id: string | null;
  status: PromotionStatus;
  submitted_by: string | null;
  submitted_by_email: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  contact_person_id: string | null;
  created_at: string;
  updated_at: string;
};

// Public URL slug: <name-slug>-<yyyy-mm-dd>-<6-char id suffix>. The id
// suffix guarantees uniqueness across identical names + dates without
// needing collision retries. Matches migration 0016 SQL.
export function makeEventSlug(name: string, eventDate: string, id: string): string {
  const base = `${name}-${eventDate}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${id.slice(0, 6)}`;
}

export type ScoringMode = "10_point_must" | "points_based";

export type BoutClass = "pro" | "amateur";

export const BOUT_CLASSES: { value: BoutClass; label: string }[] = [
  { value: "pro", label: "Professional" },
  { value: "amateur", label: "Amateur" },
];

export type Bout = {
  id: string;
  event_id: string;
  bout_order: number | null;
  sport: string;
  weight_class: string | null;
  contracted_weight_lbs: number | null;
  rounds: number | null;
  round_length_minutes: number | null;
  scoring_mode: ScoringMode | null;
  bout_class: BoutClass;
  ruleset_id: string | null;
  scheduled_start_time: string | null;
  red_corner_fighter_id: string | null;
  blue_corner_fighter_id: string | null;
  result: string | null;
  method: string | null;
  round_finished: number | null;
  time_finished: string | null;
  records_applied: boolean;
  notes: string | null;
  created_at: string;
};

export const SPORTS = [
  "boxing",
  "mma",
  "kickboxing",
  "muay thai",
  "bjj",
  "wrestling",
  "karate",
] as const;

export const STANCES = ["orthodox", "southpaw", "switch"] as const;

export const OFFICIAL_ROLES: OfficialRole[] = [
  "referee",
  "judge",
  "doctor",
  "timekeeper",
  "inspector",
];

export const EVENT_STATUSES: EventStatus[] = ["draft", "scheduled", "complete", "canceled"];

export const SCORING_MODES: { value: ScoringMode; label: string }[] = [
  { value: "10_point_must", label: "10-point must (boxing / MMA / kickboxing)" },
  { value: "points_based", label: "Points-based (wrestling / BJJ)" },
];

export type EventOfficial = {
  id: string;
  event_id: string;
  official_id: string;
  event_role: EventRole;
  created_at: string;
};

export type BoutScorecard = {
  id: string;
  bout_id: string;
  judge_official_id: string;
  round_number: number;
  red_score: number;
  blue_score: number;
  knockdowns_red: number;
  knockdowns_blue: number;
  notes: string | null;
  submitted_at: string;
};

export const EVENT_ROLES: EventRole[] = [
  "head_official",
  "referee",
  "judge",
  "jury",
  "doctor",
  "timekeeper",
  "inspector",
];

export const EVENT_ROLE_LABELS: Record<EventRole, string> = {
  head_official: "Head official",
  referee: "Referee",
  judge: "Judge",
  jury: "Jury",
  doctor: "Doctor",
  timekeeper: "Timekeeper",
  inspector: "Inspector",
};

export type BoutOutcome = "red" | "blue" | "draw" | "no_contest";

export const BOUT_OUTCOMES: { value: BoutOutcome; label: string }[] = [
  { value: "red", label: "Red corner wins" },
  { value: "blue", label: "Blue corner wins" },
  { value: "draw", label: "Draw" },
  { value: "no_contest", label: "No contest" },
];

export type BoutMethod =
  | "ko"
  | "tko"
  | "submission"
  | "decision_unanimous"
  | "decision_split"
  | "decision_majority"
  | "draw_unanimous"
  | "draw_split"
  | "draw_majority"
  | "dq"
  | "nc";

export const BOUT_METHODS: { value: BoutMethod; label: string }[] = [
  { value: "ko", label: "KO — knockout" },
  { value: "tko", label: "TKO — technical knockout" },
  { value: "submission", label: "Submission" },
  { value: "decision_unanimous", label: "Decision — unanimous" },
  { value: "decision_split", label: "Decision — split" },
  { value: "decision_majority", label: "Decision — majority" },
  { value: "draw_unanimous", label: "Draw — unanimous" },
  { value: "draw_split", label: "Draw — split" },
  { value: "draw_majority", label: "Draw — majority" },
  { value: "dq", label: "Disqualification" },
  { value: "nc", label: "No contest" },
];

// Auto-suggest a decision result from scorecards. Returns null if not decidable
// (no cards, or a stoppage occurred — those need manual entry).
export function suggestResultFromScorecards(
  scorecards: BoutScorecard[],
): { outcome: BoutOutcome; method: BoutMethod } | null {
  if (scorecards.length === 0) return null;

  const byJudge = new Map<string, BoutScorecard[]>();
  for (const c of scorecards) {
    const arr = byJudge.get(c.judge_official_id) ?? [];
    arr.push(c);
    byJudge.set(c.judge_official_id, arr);
  }

  let red = 0;
  let blue = 0;
  let even = 0;
  for (const arr of byJudge.values()) {
    const r = arr.reduce((s, c) => s + c.red_score, 0);
    const b = arr.reduce((s, c) => s + c.blue_score, 0);
    if (r > b) red++;
    else if (b > r) blue++;
    else even++;
  }

  const totalJudges = red + blue + even;
  if (totalJudges === 0) return null;

  // Winner side
  const winner: BoutOutcome | null =
    red > blue && red > even ? "red" : blue > red && blue > even ? "blue" : null;

  // Method flavor
  if (winner) {
    if (red === totalJudges || blue === totalJudges) {
      return { outcome: winner, method: "decision_unanimous" };
    }
    if (even > 0 && (red + even === totalJudges || blue + even === totalJudges)) {
      return { outcome: winner, method: "decision_majority" };
    }
    return { outcome: winner, method: "decision_split" };
  }

  // Draw flavors
  if (even === totalJudges) return { outcome: "draw", method: "draw_unanimous" };
  if (red === blue) return { outcome: "draw", method: "draw_split" };
  return { outcome: "draw", method: "draw_majority" };
}

// Per-fighter W/L/D delta for a bout result. `no_contest` and any result with
// a missing corner produces no impact — matches the backfill in migration 0004.
export type RecordColumn = "wins" | "losses" | "draws";
export type FighterRecordDelta = { fighter_id: string; column: RecordColumn };

export function computeRecordDeltas(
  result: BoutOutcome | null,
  red_id: string | null,
  blue_id: string | null,
): FighterRecordDelta[] {
  if (!result || result === "no_contest") return [];
  if (result === "red") {
    const out: FighterRecordDelta[] = [];
    if (red_id) out.push({ fighter_id: red_id, column: "wins" });
    if (blue_id) out.push({ fighter_id: blue_id, column: "losses" });
    return out;
  }
  if (result === "blue") {
    const out: FighterRecordDelta[] = [];
    if (blue_id) out.push({ fighter_id: blue_id, column: "wins" });
    if (red_id) out.push({ fighter_id: red_id, column: "losses" });
    return out;
  }
  // draw
  const out: FighterRecordDelta[] = [];
  if (red_id) out.push({ fighter_id: red_id, column: "draws" });
  if (blue_id) out.push({ fighter_id: blue_id, column: "draws" });
  return out;
}

export function fighterColumnFor(bout_class: BoutClass, column: RecordColumn): string {
  const prefix = bout_class === "pro" ? "pro_" : "am_";
  return `${prefix}${column}`;
}

// ── Pre-fight check-in ─────────────────────────────────────────────────────

export type Corner = "red" | "blue";

export type BoutFighterCheck = {
  id: string;
  bout_id: string;
  corner: Corner;
  checked_in_at: string | null;
  weigh_in_lbs: number | null;
  weigh_in_at: string | null;
  weigh_in_notes: string | null;
  medical_cleared_at: string | null;
  medical_notes: string | null;
  cleared_to_fight: boolean;
  cleared_to_fight_at: string | null;
  override_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WeighInStatus = "under" | "on" | "over" | "unknown";

// Boxing convention: ≤ contract = on/under (legal), > contract = over (fine or
// bout renegotiation). ½-lb allowance is standard in most jurisdictions.
export function weighInStatus(
  contractedLbs: number | null,
  actualLbs: number | null,
  allowanceLbs = 0.5,
): WeighInStatus {
  if (contractedLbs == null || actualLbs == null) return "unknown";
  if (actualLbs > contractedLbs + allowanceLbs) return "over";
  if (actualLbs < contractedLbs - allowanceLbs) return "under";
  return "on";
}

export type CheckinGate = "check_in" | "weigh_in" | "medical" | "cleared";

export type CheckinProgress = {
  checkedIn: boolean;
  weighedIn: boolean;
  medicalCleared: boolean;
  clearedToFight: boolean;
};

export function checkinProgress(check: BoutFighterCheck | null | undefined): CheckinProgress {
  return {
    checkedIn: Boolean(check?.checked_in_at),
    weighedIn: check?.weigh_in_lbs != null,
    medicalCleared: Boolean(check?.medical_cleared_at),
    clearedToFight: Boolean(check?.cleared_to_fight),
  };
}

// ── Sanctioning documents ─────────────────────────────────────────────────

export type BoutDocumentKind = "bout_agreement" | "fight_report";

export const BOUT_DOCUMENT_KINDS: { value: BoutDocumentKind; label: string; hint: string }[] = [
  {
    value: "bout_agreement",
    label: "Bout agreement",
    hint: "Pre-fight contract — matchup, rules, weight class, contracted weight, sanctioning body, signature blocks.",
  },
  {
    value: "fight_report",
    label: "Fight report",
    hint: "Post-fight report for the sanctioning body — result, method, scorecards, medical clearance.",
  },
];

export type BoutDocument = {
  id: string;
  bout_id: string;
  kind: BoutDocumentKind;
  filed_at: string;
  filed_by: string | null;
  filed_with: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ── Medical clearances ────────────────────────────────────────────────────

export type MedicalRecordKind =
  | "physical"
  | "bloodwork"
  | "ophthalmology"
  | "mri"
  | "ekg"
  | "neuro";

export const MEDICAL_RECORD_KINDS: {
  value: MedicalRecordKind;
  label: string;
  hint: string;
  default_expiry_months: number;
}[] = [
  {
    value: "physical",
    label: "Annual physical",
    hint: "General physical exam by a licensed physician. Standard 1-year validity.",
    default_expiry_months: 12,
  },
  {
    value: "bloodwork",
    label: "Bloodwork (HIV / HepB / HepC)",
    hint: "Required labs — HIV, Hepatitis B, Hepatitis C. Usually 6–12 months.",
    default_expiry_months: 6,
  },
  {
    value: "ophthalmology",
    label: "Eye exam (ophthalmology)",
    hint: "Dilated eye exam by an ophthalmologist. 1-year standard.",
    default_expiry_months: 12,
  },
  {
    value: "mri",
    label: "MRI / CT brain",
    hint: "Brain imaging. Commonly 3–5 years for pros; sometimes required for all.",
    default_expiry_months: 36,
  },
  {
    value: "ekg",
    label: "EKG",
    hint: "12-lead EKG. Often required annually, especially fighters 35+.",
    default_expiry_months: 12,
  },
  {
    value: "neuro",
    label: "Neurological exam",
    hint: "Post-KO or sanctioning-body-mandated neuro consultation.",
    default_expiry_months: 12,
  },
];

export type FighterMedicalRecord = {
  id: string;
  fighter_id: string;
  kind: MedicalRecordKind;
  issued_on: string;
  expires_on: string | null;
  issuing_physician: string | null;
  issuing_facility: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClearanceStatus = "active" | "expiring" | "expired" | "missing";

// Days out from expiry where we start warning "expiring soon".
const EXPIRING_WINDOW_DAYS = 30;

export function daysUntil(dateISO: string | null, asOfISO?: string): number | null {
  if (!dateISO) return null;
  const asOf = asOfISO ? new Date(asOfISO) : new Date();
  const target = new Date(dateISO);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((target.getTime() - asOf.getTime()) / msPerDay);
}

export function recordStatus(
  record: FighterMedicalRecord | null | undefined,
  asOfISO?: string,
): ClearanceStatus {
  if (!record) return "missing";
  const days = daysUntil(record.expires_on, asOfISO);
  if (days == null) return "active"; // no expiry set — treat as always-active
  if (days < 0) return "expired";
  if (days <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "active";
}

// Given a fighter's full history, return the most-recent (by issued_on) record
// per kind — that's the one whose status matters.
export function latestByKind(
  records: FighterMedicalRecord[],
): Map<MedicalRecordKind, FighterMedicalRecord> {
  const map = new Map<MedicalRecordKind, FighterMedicalRecord>();
  for (const r of records) {
    const existing = map.get(r.kind);
    if (!existing || new Date(r.issued_on) > new Date(existing.issued_on)) {
      map.set(r.kind, r);
    }
  }
  return map;
}

export type FighterClearanceSummary = {
  worstStatus: ClearanceStatus;
  counts: Record<ClearanceStatus, number>;
  perKind: { kind: MedicalRecordKind; status: ClearanceStatus; record: FighterMedicalRecord | null }[];
};

const STATUS_RANK: Record<ClearanceStatus, number> = {
  expired: 3,
  missing: 2,
  expiring: 1,
  active: 0,
};

// ── Purses & payouts ──────────────────────────────────────────────────────

export type BoutPurse = {
  id: string;
  bout_id: string;
  corner: Corner;
  gross_purse: number | string;
  manager_pct: number | string;
  sanctioning_fee: number | string;
  tax_withholding: number | string;
  other_deductions: number | string;
  other_deductions_note: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Coerce a possibly-string DB numeric column into a number. Supabase returns
// `numeric` columns as strings by default; this normalizes both.
export function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export type PurseBreakdown = {
  gross: number;
  managerPct: number;
  managerAmount: number;
  sanctioningFee: number;
  taxWithholding: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
};

export function purseBreakdown(p: BoutPurse | null | undefined): PurseBreakdown {
  const gross = num(p?.gross_purse);
  const managerPct = num(p?.manager_pct);
  const managerAmount = Math.round(gross * managerPct) / 100;
  const sanctioningFee = num(p?.sanctioning_fee);
  const taxWithholding = num(p?.tax_withholding);
  const otherDeductions = num(p?.other_deductions);
  const totalDeductions = managerAmount + sanctioningFee + taxWithholding + otherDeductions;
  const net = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);
  return {
    gross,
    managerPct,
    managerAmount,
    sanctioningFee,
    taxWithholding,
    otherDeductions,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    net,
  };
}

export function fmtMoney(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Official availability ─────────────────────────────────────────────────

export type AvailabilityStatus = "unavailable" | "tentative";

export type OfficialAvailability = {
  id: string;
  official_id: string;
  block_date: string;
  status: AvailabilityStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const AVAILABILITY_STATUSES: { value: AvailabilityStatus; label: string }[] = [
  { value: "unavailable", label: "Unavailable" },
  { value: "tentative", label: "Tentative" },
];

// ── Official prior events (backfilled pre-CombatPro history) ──────────────

export type OfficialPriorEvent = {
  id: string;
  official_id: string;
  event_date: string;
  event_name: string;
  role: OfficialRole;
  sanctioning_body: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
};

// ── Event ledger (revenue + expenses) ─────────────────────────────────────

export type LedgerEntryType = "revenue" | "expense";

export type PaymentMethod = "cash" | "check" | "ach" | "card" | "wire" | "other";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH / bank transfer" },
  { value: "card", label: "Card" },
  { value: "wire", label: "Wire" },
  { value: "other", label: "Other" },
];

export function paymentMethodLabel(m: PaymentMethod | null): string | null {
  if (!m) return null;
  return PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;
}

export type LedgerEntry = {
  id: string;
  event_id: string;
  entry_type: LedgerEntryType;
  category: string;
  subcategory: string | null;
  label: string;
  amount: number | string;
  vendor_id: string | null;
  payment_method: PaymentMethod | null;
  received_at: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Vendor registry — cross-event so promoters can see who they're paying
// most across their whole book. FK on event_ledger.vendor_id is nullable.
export type Vendor = {
  id: string;
  name: string;
  default_category: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const REVENUE_CATEGORIES: { value: string; label: string }[] = [
  { value: "ticket_sales", label: "Ticket sales" },
  { value: "sponsorship", label: "Sponsorship" },
  { value: "concessions", label: "Concessions / bar" },
  { value: "merchandise", label: "Merchandise" },
  { value: "ppv", label: "PPV / broadcast" },
  { value: "other", label: "Other" },
];

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "venue", label: "Venue rental" },
  { value: "marketing", label: "Marketing / ads" },
  { value: "insurance", label: "Insurance" },
  { value: "staff", label: "Staff / officials" },
  { value: "security", label: "Security" },
  { value: "medical", label: "Medical / ringside" },
  { value: "transport", label: "Transport / lodging" },
  { value: "catering", label: "Catering" },
  { value: "other", label: "Other" },
];

export function ledgerCategoryLabel(entry: Pick<LedgerEntry, "entry_type" | "category">): string {
  const list = entry.entry_type === "revenue" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.value === entry.category)?.label ?? entry.category;
}

export type EventPnL = {
  revenue: number;
  expenses: number;
  purses: number;
  net: number;
};

export function computeEventPnL(
  entries: LedgerEntry[],
  fighterNet: number,
): EventPnL {
  let revenue = 0;
  let expenses = 0;
  for (const e of entries) {
    const amt = num(e.amount);
    if (e.entry_type === "revenue") revenue += amt;
    else expenses += amt;
  }
  const net = revenue - expenses - fighterNet;
  return {
    revenue: Math.round(revenue * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    purses: Math.round(fighterNet * 100) / 100,
    net: Math.round(net * 100) / 100,
  };
}

// ── Rulesets ──────────────────────────────────────────────────────────────

// ── Fighter weight tracking ──────────────────────────────────────────────

export type FighterWeightLogEntry = {
  id: string;
  fighter_id: string;
  weight_lbs: number | string;
  recorded_at: string;
  source: string | null;
  notes: string | null;
  logged_by: string | null;
};

export type FighterClassPreference = {
  id: string;
  fighter_id: string;
  sport: string;
  class_name: string;
  updated_at: string;
};

// ── Fight records (canonical bout history w/ confidence) ─────────────────

export const FIGHT_CONFIDENCE = ["verified", "corroborated", "reported", "disputed"] as const;
export type FightConfidence = (typeof FIGHT_CONFIDENCE)[number];

export const FIGHT_OUTCOMES = ["win", "loss", "draw", "no_contest"] as const;
export type FightOutcome = (typeof FIGHT_OUTCOMES)[number];

export const FIGHT_CONFIDENCE_META: Record<
  FightConfidence,
  { label: string; icon: string; className: string; description: string }
> = {
  verified: {
    label: "Verified",
    icon: "🟢",
    className: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
    description: "Directly confirmed by an authoritative source.",
  },
  corroborated: {
    label: "Corroborated",
    icon: "🔵",
    className: "border-blue-500/50 text-blue-700 dark:text-blue-300",
    description: "Two or more independent sources agree.",
  },
  reported: {
    label: "Reported",
    icon: "🟡",
    className: "border-amber-500/50 text-amber-700 dark:text-amber-300",
    description: "Submitted by someone in the ecosystem; unconfirmed.",
  },
  disputed: {
    label: "Disputed",
    icon: "🔴",
    className: "border-red-500/50 text-red-700 dark:text-red-300",
    description: "Conflicting information exists.",
  },
};

export type FightRecord = {
  id: string;
  fighter_id: string;
  opponent_fighter_id: string | null;
  opponent_name: string;
  fight_date: string;
  result: FightOutcome;
  method: string | null;
  round_finished: number | null;
  time_finished: string | null;
  sport: string | null;
  weight_class: string | null;
  is_pro: boolean;
  confidence: FightConfidence;
  source_label: string | null;
  bout_id: string | null;
  event_name: string | null;
  location: string | null;
  submitted_by: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
};

export type RulesetPdfVersion = {
  id: string;
  ruleset_id: string;
  storage_path: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  extracted_json: unknown;
  extraction_error: string | null;
  is_current: boolean;
};

export type Ruleset = {
  id: string;
  name: string;
  sport: string;
  sanctioning_body_id: string | null;
  commission_id: string | null;
  is_default: boolean;
  rounds_championship: number | null;
  rounds_non_championship: number | null;
  round_length_minutes: number | string | null;
  rest_length_seconds: number | null;
  scoring_mode: ScoringMode | null;
  weight_allowance_lbs: number | string | null;
  glove_specs: string | null;
  wraps_spec: string | null;
  three_knockdown_rule: boolean;
  standing_eight_count: boolean;
  open_scoring: boolean;
  protective_gear: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ── Gyms & cornermen ──────────────────────────────────────────────────────

export type Gym = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  head_coach: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CornermanRole =
  | "head_coach"
  | "assistant_coach"
  | "cutman"
  | "manager"
  | "other";

export const CORNERMAN_ROLES: { value: CornermanRole; label: string }[] = [
  { value: "head_coach", label: "Head coach" },
  { value: "assistant_coach", label: "Assistant coach" },
  { value: "cutman", label: "Cutman" },
  { value: "manager", label: "Manager" },
  { value: "other", label: "Other" },
];

export type BoutCornerman = {
  id: string;
  bout_id: string;
  corner: Corner;
  name: string;
  role: CornermanRole;
  gym_id: string | null;
  notes: string | null;
  created_at: string;
};

export function cornermanRoleLabel(role: CornermanRole): string {
  return CORNERMAN_ROLES.find((r) => r.value === role)?.label ?? role;
}

// ── Sponsors ──────────────────────────────────────────────────────────────

export type Sponsor = {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SponsorTier =
  | "title"
  | "presenting"
  | "gold"
  | "silver"
  | "bronze"
  | "associate"
  | "media"
  | "in_kind";

export const SPONSOR_TIERS: { value: SponsorTier; label: string; hint: string }[] = [
  { value: "title", label: "Title", hint: "Event named after sponsor — top billing." },
  { value: "presenting", label: "Presenting", hint: "\"Presented by\" — second only to title." },
  { value: "gold", label: "Gold", hint: "Premium tier — logo on cage/ring + banner." },
  { value: "silver", label: "Silver", hint: "Mid tier — logo on banners + program." },
  { value: "bronze", label: "Bronze", hint: "Entry tier — logo in program." },
  { value: "associate", label: "Associate", hint: "Small-value slot — logo credit only." },
  { value: "media", label: "Media", hint: "Media / broadcast partner — trade or in-kind." },
  { value: "in_kind", label: "In-kind", hint: "Product / service instead of cash." },
];

const SPONSOR_TIER_RANK: Record<SponsorTier, number> = {
  title: 0,
  presenting: 1,
  gold: 2,
  silver: 3,
  bronze: 4,
  associate: 5,
  media: 6,
  in_kind: 7,
};

export function sponsorTierLabel(tier: SponsorTier): string {
  return SPONSOR_TIERS.find((t) => t.value === tier)?.label ?? tier;
}

export function compareSponsorTier(a: SponsorTier, b: SponsorTier): number {
  return SPONSOR_TIER_RANK[a] - SPONSOR_TIER_RANK[b];
}

// ── Sponsorable items ─────────────────────────────────────────────────────
// A fixed catalog of things a sponsor can back for a given event. Multiple
// sponsors can back the same item (e.g. two logos on the ring mat). "custom"
// keeps the escape hatch for one-off assets — free-text goes in slot_label.

export type SponsorableItem =
  | "ring"
  | "blue_corner"
  | "red_corner"
  | "round_card"
  | "officials"
  | "ring_girls"
  | "mat"
  | "main_event"
  | "co_main"
  | "undercard"
  | "broadcast"
  | "program"
  | "custom";

export const SPONSORABLE_ITEMS: {
  value: SponsorableItem;
  label: string;
  hint: string;
}[] = [
  { value: "ring", label: "The Ring / Cage", hint: "Ring or cage itself — banners, apron, logo mat." },
  { value: "blue_corner", label: "Blue Corner", hint: "Blue-corner stool, post, or corner pad." },
  { value: "red_corner", label: "Red Corner", hint: "Red-corner stool, post, or corner pad." },
  { value: "round_card", label: "Round / Time Card", hint: "The card carried between rounds." },
  { value: "officials", label: "Officials", hint: "Referees, judges, timekeeper apparel." },
  { value: "ring_girls", label: "Ring Girls", hint: "Ring / octagon girls." },
  { value: "mat", label: "Mat / Canvas", hint: "Ring canvas logo placement." },
  { value: "main_event", label: "Main Event", hint: "Presenting sponsor of the main event bout." },
  { value: "co_main", label: "Co-Main Event", hint: "Presenting sponsor of the co-main bout." },
  { value: "undercard", label: "Undercard", hint: "Presenting sponsor of the undercard." },
  { value: "broadcast", label: "Broadcast", hint: "Live stream / broadcast partner." },
  { value: "program", label: "Program", hint: "Printed program or fight-night booklet." },
  { value: "custom", label: "Custom", hint: "Anything else — describe in the label field." },
];

const SPONSORABLE_ITEM_RANK: Record<SponsorableItem, number> = {
  ring: 0,
  mat: 1,
  blue_corner: 2,
  red_corner: 3,
  main_event: 4,
  co_main: 5,
  undercard: 6,
  round_card: 7,
  officials: 8,
  ring_girls: 9,
  broadcast: 10,
  program: 11,
  custom: 12,
};

// Widened to `string` so callers rendering an EventSponsor.item_type (which
// may be a promoter-added custom key) don't have to narrow first. Falls back
// to returning the raw key when nothing matches.
export function sponsorableItemLabel(item: string): string {
  return SPONSORABLE_ITEMS.find((i) => i.value === item)?.label ?? item;
}

export function compareSponsorableItem(
  a: SponsorableItem,
  b: SponsorableItem,
): number {
  return SPONSORABLE_ITEM_RANK[a] - SPONSORABLE_ITEM_RANK[b];
}

// After migration 0032 the item_type column is opaque text: it holds either a
// built-in SponsorableItem key or a custom key that resolves via
// event_sponsorable_items for that event.
export type SponsorItemKey = SponsorableItem | (string & {});

export type EventSponsorableItem = {
  id: string;
  event_id: string;
  key: string;
  label: string;
  hint: string | null;
  hidden: boolean;
  sort_order: number;
  created_at: string;
};

// URL-safe key derived from a user-provided label. Kept identical between
// client and server so validation of "no built-in collision" gives the same
// verdict everywhere.
export function slugifySponsorItemKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function isBuiltInSponsorItem(key: string): key is SponsorableItem {
  return SPONSORABLE_ITEMS.some((i) => i.value === key);
}

export function resolveItemLabel(
  key: string,
  customItems: Pick<EventSponsorableItem, "key" | "label">[] = [],
): string {
  if (isBuiltInSponsorItem(key)) return sponsorableItemLabel(key);
  return customItems.find((c) => c.key === key)?.label ?? key;
}

export type EventSponsor = {
  id: string;
  event_id: string;
  sponsor_id: string;
  tier: SponsorTier;
  item_type: SponsorItemKey;
  slot_label: string | null;
  contract_value: number | string;
  paid_at: string | null;
  ledger_entry_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventSponsorTarget = {
  event_id: string;
  item_type: SponsorItemKey;
  target_value: number | string;
  updated_at: string;
};

export type SponsorshipTotals = {
  contracted: number;
  paid: number;
  outstanding: number;
  slotCount: number;
};

export function sponsorshipTotals(slots: EventSponsor[]): SponsorshipTotals {
  let contracted = 0;
  let paid = 0;
  for (const s of slots) {
    const v = num(s.contract_value);
    contracted += v;
    if (s.paid_at) paid += v;
  }
  return {
    contracted: Math.round(contracted * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    outstanding: Math.round((contracted - paid) * 100) / 100,
    slotCount: slots.length,
  };
}

export function fighterClearanceSummary(
  records: FighterMedicalRecord[],
  requiredKinds: MedicalRecordKind[] = MEDICAL_RECORD_KINDS.map((k) => k.value),
  asOfISO?: string,
): FighterClearanceSummary {
  const latest = latestByKind(records);
  const counts: Record<ClearanceStatus, number> = { active: 0, expiring: 0, expired: 0, missing: 0 };
  const perKind = requiredKinds.map((kind) => {
    const record = latest.get(kind) ?? null;
    const status = recordStatus(record, asOfISO);
    counts[status]++;
    return { kind, status, record };
  });
  let worstStatus: ClearanceStatus = "active";
  for (const { status } of perKind) {
    if (STATUS_RANK[status] > STATUS_RANK[worstStatus]) worstStatus = status;
  }
  return { worstStatus, counts, perKind };
}
