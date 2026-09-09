-- CombatPro — public shareable slug on events.
--
-- Slug = slugified name + event date + 6-char id suffix. The id suffix
-- guarantees uniqueness across duplicated event names (rematches, series
-- like "King of the Cage 3") without extra collision-handling logic.

do $$ begin
  alter table public.events add column slug text;
exception when duplicate_column then null; end $$;

update public.events
set slug =
  trim(both '-' from lower(
    regexp_replace(
      name || '-' || to_char(event_date, 'YYYY-MM-DD'),
      '[^a-z0-9]+', '-', 'gi'
    )
  ))
  || '-' || substring(id::text, 1, 6)
where slug is null;

create unique index if not exists events_slug_key
  on public.events(slug)
  where slug is not null;
