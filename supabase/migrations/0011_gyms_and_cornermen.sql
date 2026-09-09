-- CombatPro — gyms registry + per-bout cornermen.
--
-- The `fighters.gym` text column stays as legacy free-text — new records
-- prefer `fighters.gym_id` (FK). Setting gym_id null keeps the legacy string
-- visible until backfilled.
--
-- `bout_cornermen` is per-corner (red/blue) with a role — head coach, cutman,
-- assistant, etc. Purely additive; no assumption a fighter's registered gym
-- matches the corner team for a given bout (they often bring a camp team).

create table if not exists public.gyms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text,
  state text,
  country text,
  head_coach text,
  contact_email text,
  contact_phone text,
  website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gyms_name_idx on public.gyms(name);
create index if not exists gyms_state_idx on public.gyms(state);

do $$ begin
  alter table public.fighters
    add column gym_id uuid references public.gyms(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists fighters_gym_id_idx on public.fighters(gym_id);

create or replace function public.gyms_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gyms_touch_trg on public.gyms;
create trigger gyms_touch_trg
  before update on public.gyms
  for each row execute function public.gyms_touch();

create table if not exists public.bout_cornermen (
  id uuid primary key default uuid_generate_v4(),
  bout_id uuid not null references public.bouts(id) on delete cascade,
  corner text not null,
  name text not null,
  role text not null default 'head_coach',
  gym_id uuid references public.gyms(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.bout_cornermen
    add constraint bout_cornermen_corner_check
    check (corner in ('red','blue'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.bout_cornermen
    add constraint bout_cornermen_role_check
    check (role in ('head_coach','assistant_coach','cutman','manager','other'));
exception when duplicate_object then null; end $$;

create index if not exists bout_cornermen_bout_idx on public.bout_cornermen(bout_id);
create index if not exists bout_cornermen_corner_idx on public.bout_cornermen(bout_id, corner);
