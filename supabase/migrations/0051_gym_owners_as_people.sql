-- CombatPro — coaches and owners are people with profiles.
--   * role is now optional and is_owner marks ownership, so one person can be
--     an owner, a coach, or both (an owner who is also the head coach).
--   * person_id ties the coach/owner to the shared person record, the same
--     one a fighter or official points at, so someone who both fights and
--     coaches is one person with both roles.
alter table public.coaches
  alter column role drop not null,
  add column if not exists is_owner boolean not null default false,
  add column if not exists person_id uuid references public.persons(id) on delete set null;

create index if not exists coaches_person_id_idx on public.coaches(person_id);

-- Carry over owner names typed into gyms.owners (comma-separated): mark an
-- existing coach of that gym with the same name, otherwise add the person.
-- gyms.owners itself is left in place but no longer used.
update public.coaches c
set is_owner = true
from public.gyms g
where c.gym_id = g.id
  and g.owners is not null
  and exists (
    select 1 from unnest(string_to_array(g.owners, ',')) n
    where lower(btrim(n)) = lower(c.full_name)
  );

insert into public.coaches (full_name, role, gym_id, is_owner)
select btrim(n), null, g.id, true
from public.gyms g
cross join lateral unnest(string_to_array(g.owners, ',')) n
where g.owners is not null
  and btrim(n) <> ''
  and not exists (
    select 1 from public.coaches c
    where c.gym_id = g.id and lower(c.full_name) = lower(btrim(n))
  );
