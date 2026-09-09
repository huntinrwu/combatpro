-- CombatPro — official availability blocks.
-- Officials are assumed available by default; this table stores exceptions
-- (unavailable / tentative) for specific dates. Also serves as an audit trail
-- of who blocked what dates and when.

create table if not exists public.official_availability (
  id uuid primary key default uuid_generate_v4(),
  official_id uuid not null references public.officials(id) on delete cascade,
  block_date date not null,
  status text not null default 'unavailable',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (official_id, block_date)
);

do $$ begin
  alter table public.official_availability
    add constraint official_availability_status_check
    check (status in ('unavailable','tentative'));
exception when duplicate_object then null; end $$;

create index if not exists official_availability_official_idx
  on public.official_availability(official_id);

create index if not exists official_availability_date_idx
  on public.official_availability(block_date);

create or replace function public.official_availability_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists official_availability_touch_trg on public.official_availability;
create trigger official_availability_touch_trg
  before update on public.official_availability
  for each row execute function public.official_availability_touch();
