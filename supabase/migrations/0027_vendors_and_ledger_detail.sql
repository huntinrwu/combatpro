-- CombatPro — vendor registry + richer expense metadata on event_ledger.
--
-- Why: promoters need to see who they're paying, how much, and how often
-- across events (vendor concentration), plus roll up cash flow by category,
-- subcategory, and payment method. The pre-existing event_ledger only had
-- a freeform "label" so identical vendors couldn't be grouped.
--
-- Vendors are cross-event (a security company works multiple cards). The
-- FK on event_ledger.vendor_id is nullable so ad-hoc entries still work.

create table if not exists public.vendors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  default_category text,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_name_idx on public.vendors (lower(name));

create or replace function public.vendors_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vendors_touch_trg on public.vendors;
create trigger vendors_touch_trg
  before update on public.vendors
  for each row execute function public.vendors_touch();

-- Extend event_ledger.
alter table public.event_ledger
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null,
  add column if not exists subcategory text,
  add column if not exists payment_method text;

do $$ begin
  alter table public.event_ledger
    add constraint event_ledger_payment_method_check
    check (
      payment_method is null
      or payment_method in ('cash','check','ach','card','wire','other')
    );
exception when duplicate_object then null; end $$;

create index if not exists event_ledger_vendor_idx
  on public.event_ledger(vendor_id)
  where vendor_id is not null;
