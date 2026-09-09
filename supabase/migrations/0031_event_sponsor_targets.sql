-- CombatPro — per-event fundraising targets per sponsorable item. Promoter
-- sets a $ goal for each item (blue corner, ring, etc.); progress = sum of
-- matching event_sponsors.contract_value vs the target for that item.

create table if not exists public.event_sponsor_targets (
  event_id uuid not null references public.events(id) on delete cascade,
  item_type text not null,
  target_value numeric(12,2) not null default 0 check (target_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (event_id, item_type)
);

do $$ begin
  alter table public.event_sponsor_targets
    add constraint event_sponsor_targets_item_type_check
    check (item_type in (
      'ring',
      'blue_corner',
      'red_corner',
      'round_card',
      'officials',
      'ring_girls',
      'mat',
      'main_event',
      'co_main',
      'undercard',
      'broadcast',
      'program',
      'custom'
    ));
exception when duplicate_object then null; end $$;

create or replace function public.event_sponsor_targets_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists event_sponsor_targets_touch_trg on public.event_sponsor_targets;
create trigger event_sponsor_targets_touch_trg
  before update on public.event_sponsor_targets
  for each row execute function public.event_sponsor_targets_touch();
