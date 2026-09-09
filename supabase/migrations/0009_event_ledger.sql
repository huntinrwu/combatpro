-- CombatPro — event revenue & expense ledger (line items per event).
-- entry_type = revenue | expense (fighter purses live in bout_purses; those are
-- an implicit expense — the event P&L sums this table AND the bout_purses net).
-- category is a free-ish enum for grouping in reports.

create table if not exists public.event_ledger (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  entry_type text not null,
  category text not null,
  label text not null,
  amount numeric(12,2) not null default 0,
  received_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.event_ledger
    add constraint event_ledger_entry_type_check
    check (entry_type in ('revenue','expense'));
exception when duplicate_object then null; end $$;

create index if not exists event_ledger_event_idx
  on public.event_ledger(event_id);

create index if not exists event_ledger_type_idx
  on public.event_ledger(event_id, entry_type);

create or replace function public.event_ledger_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists event_ledger_touch_trg on public.event_ledger;
create trigger event_ledger_touch_trg
  before update on public.event_ledger
  for each row execute function public.event_ledger_touch();
