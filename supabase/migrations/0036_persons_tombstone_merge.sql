-- CombatPro — persons: keep merged rows as tombstones instead of deleting.
--
-- Rationale: CP-numbers must be permanent. Once CP-10007 is assigned, that
-- identifier belongs to that person forever, even if the row later gets
-- merged into another. Deleting freed the number up for reuse — confusing
-- when anyone remembers or references the old number.
--
-- Approach: add merged_into_person_id + merged_at columns. On merge, we
-- move all FKs to the target, then blank out identifying fields on the
-- source (email, phone, dob, etc.) and stamp it with the merge pointer.
-- The row survives so lookups by CP-number still work, and the person_no
-- is never recycled. The persons list UI filters tombstones by default.

alter table public.persons
  add column if not exists merged_into_person_id uuid references public.persons(id) on delete set null;

alter table public.persons
  add column if not exists merged_at timestamptz;

create index if not exists persons_merged_into_idx
  on public.persons(merged_into_person_id);

-- Rewrite merge_persons to tombstone rather than delete.
create or replace function public.merge_persons(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.persons;
  v_target public.persons;
begin
  if p_source = p_target then
    raise exception 'merge_persons: source and target are the same';
  end if;

  select * into v_source from public.persons where id = p_source;
  select * into v_target from public.persons where id = p_target;

  if v_source.id is null then
    raise exception 'merge_persons: source not found';
  end if;
  if v_target.id is null then
    raise exception 'merge_persons: target not found';
  end if;
  if v_source.merged_into_person_id is not null then
    raise exception 'merge_persons: source (CP-%) is already merged into another person', v_source.person_no;
  end if;
  if v_target.merged_into_person_id is not null then
    raise exception 'merge_persons: target (CP-%) is already merged into another person', v_target.person_no;
  end if;

  if v_source.auth_user_id is not null
     and v_target.auth_user_id is not null
     and v_source.auth_user_id <> v_target.auth_user_id then
    raise exception 'merge_persons: both persons are linked to different auth accounts';
  end if;

  -- Move every FK reference from source to target.
  update public.profiles     set person_id         = p_target where person_id         = p_source;
  update public.fighters     set person_id         = p_target where person_id         = p_source;
  update public.officials    set person_id         = p_target where person_id         = p_source;
  update public.promotions   set contact_person_id = p_target where contact_person_id = p_source;

  -- Inherit the auth link if target didn't have one. Two-step because
  -- persons.auth_user_id is unique.
  if v_target.auth_user_id is null and v_source.auth_user_id is not null then
    update public.persons set auth_user_id = null where id = p_source;
    update public.persons set auth_user_id = v_source.auth_user_id where id = p_target;
  end if;

  -- Fill any empty fields on the target from the source.
  update public.persons
    set full_name     = coalesce(nullif(full_name, ''), v_source.full_name),
        email         = coalesce(email, v_source.email),
        phone         = coalesce(phone, v_source.phone),
        avatar_url    = coalesce(avatar_url, v_source.avatar_url),
        date_of_birth = coalesce(date_of_birth, v_source.date_of_birth),
        hometown      = coalesce(hometown, v_source.hometown),
        nationality   = coalesce(nationality, v_source.nationality),
        updated_at    = now()
    where id = p_target;

  -- Log the merge for audit.
  insert into public.person_merges (
    source_person_no, source_full_name, source_email,
    target_person_id, target_person_no, merged_by
  )
  values (
    v_source.person_no, v_source.full_name, v_source.email,
    p_target, v_target.person_no, auth.uid()
  );

  -- Tombstone the source. Keep person_no + full_name (so lookups can
  -- explain what happened); null out contact fields so the unique email
  -- index doesn't block future re-use of the address by someone else.
  update public.persons
    set merged_into_person_id = p_target,
        merged_at             = now(),
        email                 = null,
        phone                 = null,
        avatar_url            = null,
        date_of_birth         = null,
        hometown              = null,
        nationality           = null,
        notes                 = trim(both E'\n' from coalesce(notes, '') || E'\n' ||
                                    format('Merged into CP-%s on %s', v_target.person_no, now()::date)),
        updated_at            = now()
    where id = p_source;
end;
$$;
