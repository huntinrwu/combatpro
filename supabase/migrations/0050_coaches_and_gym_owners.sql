-- CombatPro — coaches get their own table (head coaches and junior coaches,
-- each attached to a gym), and gyms get an owners field: an owner is not
-- always the head coach, and a head coach is not always an owner.
create table if not exists public.coaches (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  role text not null default 'head_coach' check (role in ('head_coach', 'jr_coach')),
  gym_id uuid references public.gyms(id) on delete set null,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists coaches_gym_id_idx on public.coaches(gym_id);

-- Like the other registry tables: no public access; the app reads and writes
-- it on the server after checking who is signed in.
alter table public.coaches enable row level security;

alter table public.gyms add column if not exists owners text;

-- Carry over the head coach typed on each gym. gyms.head_coach itself is left
-- in place but no longer used.
insert into public.coaches (full_name, role, gym_id)
select btrim(g.head_coach), 'head_coach', g.id
from public.gyms g
where g.head_coach is not null
  and btrim(g.head_coach) <> ''
  and not exists (select 1 from public.coaches c where c.gym_id = g.id);
