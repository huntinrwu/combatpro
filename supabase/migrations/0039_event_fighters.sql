-- CombatPro — per-event fighter roster.
-- Fighters are added to an event first, then matched into bouts. The roster
-- is the pool the bout form picks from, and it is where a promoter tracks
-- who is confirmed, who withdrew, and who still needs an opponent.
create table if not exists public.event_fighters (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'withdrawn')),
  target_weight_lbs numeric(5, 1),
  notes text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, fighter_id)
);

create index if not exists event_fighters_event_idx on public.event_fighters(event_id);
create index if not exists event_fighters_fighter_idx on public.event_fighters(fighter_id);

-- Server actions use the service role; no anon/authenticated policies.
alter table public.event_fighters enable row level security;

-- Backfill: anyone already matched on a card is on that event's roster.
insert into public.event_fighters (event_id, fighter_id, status, target_weight_lbs)
select distinct on (b.event_id, f.fighter_id)
  b.event_id, f.fighter_id, 'confirmed', b.contracted_weight_lbs
from public.bouts b
cross join lateral (
  values (b.red_corner_fighter_id), (b.blue_corner_fighter_id)
) as f(fighter_id)
where f.fighter_id is not null
order by b.event_id, f.fighter_id, b.created_at
on conflict (event_id, fighter_id) do nothing;
