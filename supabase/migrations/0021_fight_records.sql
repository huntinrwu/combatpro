-- CombatPro — canonical fighter records with confidence levels.
--
-- Every fighter's lifetime bout history lives in fight_records. Each row is
-- one bout AS SEEN BY one fighter (so a single bout produces two rows). Rows
-- carry a confidence level:
--
--   verified      — directly confirmed by an authoritative source
--                   (bouts we ran on the platform, commission record cards)
--   corroborated  — two or more independent sources agree
--   reported      — one submission, unconfirmed
--   disputed      — conflicting information exists (needs staff resolution)
--
-- The legacy pro_wins/pro_losses/... columns on fighters stay editable as a
-- static override. fight_records is the source-of-truth for the badged
-- profile widget; the legacy columns are what promoters/matchmakers still
-- treat as the "official" record for their own contracts.

do $$ begin
  create type fight_confidence as enum ('verified', 'corroborated', 'reported', 'disputed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fight_outcome as enum ('win', 'loss', 'draw', 'no_contest');
exception when duplicate_object then null; end $$;

create table if not exists public.fight_records (
  id uuid primary key default uuid_generate_v4(),
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  opponent_fighter_id uuid references public.fighters(id) on delete set null,
  opponent_name text not null,
  fight_date date not null,
  result fight_outcome not null,
  method text,
  round_finished integer,
  time_finished text,
  sport text,
  weight_class text,
  is_pro boolean not null default true,
  confidence fight_confidence not null default 'reported',
  source_label text,        -- free-form; "FSBC record card", "self-reported", etc.
  bout_id uuid references public.bouts(id) on delete set null,
  event_name text,
  location text,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text
);

create index if not exists fight_records_fighter_idx on public.fight_records(fighter_id);
create index if not exists fight_records_bout_idx on public.fight_records(bout_id);
create index if not exists fight_records_date_idx
  on public.fight_records(fighter_id, fight_date desc);

-- One fight_record per (bout, fighter) — the sync from declareBoutResult
-- upserts against this. Only enforced when bout_id is not null so that
-- externally-reported bouts can duplicate freely.
create unique index if not exists fight_records_bout_fighter_uniq
  on public.fight_records(bout_id, fighter_id)
  where bout_id is not null;
