-- CombatPro — M0.6: bout assignments + live scoring

-- Officials assigned to bouts (referee, judges, doctor, timekeeper, inspector).
-- Same official can hold different assignment roles across bouts, but
-- can only appear once per bout.
create table if not exists public.bout_assignments (
  id uuid primary key default uuid_generate_v4(),
  bout_id uuid not null references public.bouts(id) on delete cascade,
  official_id uuid not null references public.officials(id) on delete cascade,
  assignment_role text not null,
  created_at timestamptz not null default now(),
  unique (bout_id, official_id)
);

create index if not exists bout_assignments_bout_idx on public.bout_assignments(bout_id);
create index if not exists bout_assignments_official_idx on public.bout_assignments(official_id);

-- Judge scorecards, one row per (bout, judge, round).
create table if not exists public.bout_scorecards (
  id uuid primary key default uuid_generate_v4(),
  bout_id uuid not null references public.bouts(id) on delete cascade,
  judge_official_id uuid not null references public.officials(id) on delete cascade,
  round_number int not null check (round_number > 0),
  red_score int not null check (red_score between 0 and 10),
  blue_score int not null check (blue_score between 0 and 10),
  knockdowns_red int not null default 0,
  knockdowns_blue int not null default 0,
  notes text,
  submitted_at timestamptz not null default now(),
  unique (bout_id, judge_official_id, round_number)
);

create index if not exists bout_scorecards_bout_idx on public.bout_scorecards(bout_id);

-- Realtime: cage-side display subscribes to scorecard changes as anon.
-- Add table to the supabase_realtime publication + permissive read policy.
do $$ begin
  alter publication supabase_realtime add table public.bout_scorecards;
exception when duplicate_object then null; end $$;

alter table public.bout_scorecards enable row level security;

drop policy if exists "bout_scorecards: public read" on public.bout_scorecards;
create policy "bout_scorecards: public read" on public.bout_scorecards
  for select using (true);
