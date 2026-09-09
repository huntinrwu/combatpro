-- CombatPro — sponsors registry + per-event sponsor slots.
--
-- `sponsors` is a reusable registry — a sponsor can back many events over time.
-- `event_sponsors` is the per-event slot: which sponsor, at what tier, for how
-- much, paid or not. When a slot is created with a contract value we also
-- write a matching row into `event_ledger` (revenue / sponsorship) and stash
-- the id in `ledger_entry_id` so we can keep the two in sync on updates and
-- delete the ledger row when the slot is removed.

create table if not exists public.sponsors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  website text,
  logo_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsors_name_idx on public.sponsors(name);

create or replace function public.sponsors_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sponsors_touch_trg on public.sponsors;
create trigger sponsors_touch_trg
  before update on public.sponsors
  for each row execute function public.sponsors_touch();

create table if not exists public.event_sponsors (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  tier text not null default 'associate',
  slot_label text,
  contract_value numeric(12,2) not null default 0,
  paid_at timestamptz,
  ledger_entry_id uuid references public.event_ledger(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.event_sponsors
    add constraint event_sponsors_tier_check
    check (tier in ('title','presenting','gold','silver','bronze','associate','media','in_kind'));
exception when duplicate_object then null; end $$;

create index if not exists event_sponsors_event_idx on public.event_sponsors(event_id);
create index if not exists event_sponsors_sponsor_idx on public.event_sponsors(sponsor_id);

create or replace function public.event_sponsors_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists event_sponsors_touch_trg on public.event_sponsors;
create trigger event_sponsors_touch_trg
  before update on public.event_sponsors
  for each row execute function public.event_sponsors_touch();
