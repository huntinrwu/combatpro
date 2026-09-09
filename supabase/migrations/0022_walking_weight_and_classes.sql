-- CombatPro — walking weight, weight log, per-sport class preferences.
--
-- Two problems this addresses:
--   1) Fighters compete in multiple sports (MMA + boxing + kickboxing) and
--      each sport has its own class taxonomy — a single fighters.weight_class
--      string can't represent that.
--   2) Real-world walking weight fluctuates between camps. We need a stable
--      "current weight" reading and a timeline of changes, without letting
--      that noise pollute the record card.

-- Current walking weight — the latest self-reported (or staff-recorded)
-- reading. Updated by the fighter_weight_log trigger below so it's always
-- the most recent log entry.
do $$ begin
  alter table public.fighters
    add column walking_weight_lbs numeric(5,2);
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.fighters
    add column walking_weight_updated_at timestamptz;
exception when duplicate_column then null; end $$;

-- Time-series of weight readings. `source` is free-form context —
-- "self-reported", "gym scale", "official weigh-in", "estimate".
create table if not exists public.fighter_weight_log (
  id uuid primary key default uuid_generate_v4(),
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  weight_lbs numeric(5,2) not null,
  recorded_at timestamptz not null default now(),
  source text,
  notes text,
  logged_by uuid references public.profiles(id) on delete set null
);

create index if not exists fighter_weight_log_fighter_idx
  on public.fighter_weight_log(fighter_id, recorded_at desc);

-- Keep fighters.walking_weight_lbs in sync with the newest log entry.
create or replace function public.fighter_weight_log_touch()
returns trigger
language plpgsql
as $$
declare
  latest_row record;
begin
  select weight_lbs, recorded_at
    into latest_row
    from public.fighter_weight_log
    where fighter_id = coalesce(new.fighter_id, old.fighter_id)
    order by recorded_at desc
    limit 1;
  update public.fighters
    set walking_weight_lbs = latest_row.weight_lbs,
        walking_weight_updated_at = latest_row.recorded_at
    where id = coalesce(new.fighter_id, old.fighter_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists fighter_weight_log_touch_trg on public.fighter_weight_log;
create trigger fighter_weight_log_touch_trg
  after insert or update or delete on public.fighter_weight_log
  for each row execute function public.fighter_weight_log_touch();

-- Per-sport class preference. One row per (fighter, sport) — that's the
-- class they intend to make in that sport. Rendered on the fighter profile
-- and used to pre-suggest the class on new bouts.
create table if not exists public.fighter_class_preferences (
  id uuid primary key default uuid_generate_v4(),
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  sport text not null,
  class_name text not null,
  updated_at timestamptz not null default now(),
  unique (fighter_id, sport)
);

create index if not exists fighter_class_prefs_fighter_idx
  on public.fighter_class_preferences(fighter_id);
