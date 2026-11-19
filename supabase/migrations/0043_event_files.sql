-- CombatPro — posters and other files attached to an event.
-- Files live in a private bucket and are served through short-lived signed
-- URLs, so contracts and permits are not publicly reachable.
create table if not exists public.event_files (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  category text not null default 'other'
    check (category in ('poster', 'photo', 'document', 'other')),
  filename text not null,
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_files_event_idx on public.event_files(event_id);

-- Server actions use the service role; no anon/authenticated policies.
alter table public.event_files enable row level security;

insert into storage.buckets (id, name, public)
values ('event-files', 'event-files', false)
on conflict (id) do update set public = excluded.public;
