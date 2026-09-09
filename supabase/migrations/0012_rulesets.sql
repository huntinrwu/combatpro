-- CombatPro — rulesets (per-sanctioning-body rule packs).
--
-- A ruleset is a reusable template: rounds, round length, scoring mode, glove
-- specs, weight allowance, KD rules, protective gear, etc. Bouts can link to
-- one via `bouts.ruleset_id`; the bout's own scalar fields (rounds,
-- round_length_minutes, scoring_mode) remain authoritative for the bout —
-- the ruleset link is used to render the extended rules section on the bout
-- agreement PDF and to seed defaults in the bout form (future work).
--
-- `sanctioning_body_id` is nullable — null = generic house rules. `is_default`
-- is intended to mark "use this by default for (sport, body)"; enforcement
-- lives in the app, not the DB (no partial unique index yet).

create table if not exists public.rulesets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sport text not null,
  sanctioning_body_id uuid references public.sanctioning_bodies(id) on delete set null,
  is_default boolean not null default false,
  rounds_championship integer,
  rounds_non_championship integer,
  round_length_minutes numeric(4,2),
  rest_length_seconds integer default 60,
  scoring_mode text,
  weight_allowance_lbs numeric(4,2) default 0.5,
  glove_specs text,
  wraps_spec text,
  three_knockdown_rule boolean not null default false,
  standing_eight_count boolean not null default true,
  open_scoring boolean not null default false,
  protective_gear text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.rulesets
    add constraint rulesets_scoring_mode_check
    check (scoring_mode is null or scoring_mode in ('10_point_must','points_based'));
exception when duplicate_object then null; end $$;

create index if not exists rulesets_sport_idx on public.rulesets(sport);
create index if not exists rulesets_sb_idx on public.rulesets(sanctioning_body_id);

create or replace function public.rulesets_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rulesets_touch_trg on public.rulesets;
create trigger rulesets_touch_trg
  before update on public.rulesets
  for each row execute function public.rulesets_touch();

do $$ begin
  alter table public.bouts
    add column ruleset_id uuid references public.rulesets(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists bouts_ruleset_id_idx on public.bouts(ruleset_id);
