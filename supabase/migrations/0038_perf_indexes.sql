-- CombatPro — hot-path indexes for foreign keys we filter on.
-- events.sanctioning_body_id + events.commission_id back the SB and
-- commission dashboards; without indexes those pages full-scan events on
-- every load. The rest of the FKs on events / bouts / fight_records are
-- already indexed in earlier migrations.

create index if not exists events_sanctioning_body_idx
  on public.events(sanctioning_body_id)
  where sanctioning_body_id is not null;

create index if not exists events_commission_idx
  on public.events(commission_id)
  where commission_id is not null;
