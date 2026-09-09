-- CombatPro — bout purses & payouts (per bout × corner).
-- One row per (bout, corner) captures gross purse, manager cut (as pct),
-- sanctioning-body fee, tax withholding, and any other deductions.
-- Net is computed on read (gross - manager_amount - sanctioning_fee -
-- tax_withholding - other_deductions). Payment status tracked inline.

create table if not exists public.bout_purses (
  id uuid primary key default uuid_generate_v4(),
  bout_id uuid not null references public.bouts(id) on delete cascade,
  corner text not null,
  gross_purse numeric(12,2) not null default 0,
  manager_pct numeric(5,2) not null default 0,
  sanctioning_fee numeric(12,2) not null default 0,
  tax_withholding numeric(12,2) not null default 0,
  other_deductions numeric(12,2) not null default 0,
  other_deductions_note text,
  paid_at timestamptz,
  paid_by text,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bout_id, corner)
);

do $$ begin
  alter table public.bout_purses
    add constraint bout_purses_corner_check check (corner in ('red','blue'));
exception when duplicate_object then null; end $$;

create index if not exists bout_purses_bout_idx on public.bout_purses(bout_id);

create or replace function public.bout_purses_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bout_purses_touch_trg on public.bout_purses;
create trigger bout_purses_touch_trg
  before update on public.bout_purses
  for each row execute function public.bout_purses_touch();
