-- CombatPro — backfilled prior work for officials.
--
-- Assignment history (from bout_assignments) only covers events run
-- through CombatPro. Officials joining the platform often have years of
-- prior work under other systems / pen-and-paper. This table lets staff
-- capture that history without inventing fake bouts.
--
-- Free-form event name is intentional: pre-CombatPro events may not exist
-- as EventRow rows and we don't want to force back-dating the events
-- table. If the promoter later loads the real event, staff can delete the
-- prior_event row and let the assignment_history take over.

create table if not exists public.official_prior_events (
  id uuid primary key default uuid_generate_v4(),
  official_id uuid not null references public.officials(id) on delete cascade,
  event_date date not null,
  event_name text not null,
  role text not null,
  sanctioning_body text,
  venue text,
  city text,
  state text,
  notes text,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.official_prior_events
    add constraint official_prior_events_role_check
    check (role in ('referee','judge','doctor','timekeeper','inspector'));
exception when duplicate_object then null; end $$;

create index if not exists official_prior_events_official_idx
  on public.official_prior_events(official_id, event_date desc);
