-- CombatPro — pre-fight check-in flow (per bout × corner).
-- One row per (bout, corner) tracks the three gates that must clear before a
-- fighter can compete: check-in (present at venue), weigh-in (within contract),
-- and medical clearance. `cleared_to_fight` is a manual toggle that officials
-- can flip once all three are satisfied (or override with reason).

create table if not exists public.bout_fighter_checks (
  id uuid primary key default uuid_generate_v4(),
  bout_id uuid not null references public.bouts(id) on delete cascade,
  corner text not null,
  checked_in_at timestamptz,
  weigh_in_lbs numeric,
  weigh_in_at timestamptz,
  weigh_in_notes text,
  medical_cleared_at timestamptz,
  medical_notes text,
  cleared_to_fight boolean not null default false,
  cleared_to_fight_at timestamptz,
  override_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bout_id, corner)
);

do $$ begin
  alter table public.bout_fighter_checks
    add constraint bout_fighter_checks_corner_check check (corner in ('red','blue'));
exception when duplicate_object then null; end $$;

create index if not exists bout_fighter_checks_bout_idx
  on public.bout_fighter_checks(bout_id);

-- Keep updated_at fresh on every write.
create or replace function public.bout_fighter_checks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bout_fighter_checks_touch_trg on public.bout_fighter_checks;
create trigger bout_fighter_checks_touch_trg
  before update on public.bout_fighter_checks
  for each row execute function public.bout_fighter_checks_touch();
