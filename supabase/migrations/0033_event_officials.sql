-- Event-level officials replace bout-level assignments.
-- Officials (judges, refs, jury, head official, timekeeper, doctor, inspector)
-- are assigned to the event once. Any judge on the roster can score any bout.
-- Same official may hold multiple roles on one event (e.g. head_official + judge).
create table if not exists public.event_officials (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete cascade,
  event_role text not null,
  created_at timestamptz not null default now(),
  unique (event_id, official_id, event_role)
);

create index if not exists event_officials_event_idx on public.event_officials(event_id);
create index if not exists event_officials_official_idx on public.event_officials(official_id);

drop table if exists public.bout_assignments cascade;
