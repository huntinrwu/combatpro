-- CombatPro — replace freeform sponsor "slot_label" with a canonical
-- sponsorable-item catalog. Existing rows migrate to item_type='custom' so
-- their old slot_label survives as the display name.

alter table public.event_sponsors
  add column if not exists item_type text not null default 'custom';

do $$ begin
  alter table public.event_sponsors
    add constraint event_sponsors_item_type_check
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

create index if not exists event_sponsors_item_type_idx
  on public.event_sponsors(event_id, item_type);
