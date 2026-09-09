-- CombatPro — rules move under commissions, add ABC, verify CSAC label.
--
-- rulesets can now belong to a specific commission (in addition to, or
-- instead of, a sanctioning body). Both FKs remain nullable — a ruleset
-- can be:
--   - commission_id only        → state/regional commission rules
--   - sanctioning_body_id only  → international/federation rules
--   - both                      → SB rules adopted by a commission
--   - neither                   → house / template rules

do $$ begin
  alter table public.rulesets
    add column commission_id uuid references public.commissions(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists rulesets_commission_idx on public.rulesets(commission_id);

-- Verify CSAC label. Seed already sets this correctly; the update is a
-- no-op unless a prior migration or manual edit changed it.
update public.sanctioning_bodies
  set name = 'Combat Sports Athletic Commission'
  where abbreviation = 'CSAC'
    and name is distinct from 'Combat Sports Athletic Commission';

-- ABC — American Boxing Commission. National boxing scope.
insert into public.sanctioning_bodies
  (name, abbreviation, sports, scope, headquarters, website, status)
values
  ('American Boxing Commission', 'ABC', array['boxing'], 'national', 'USA', null, 'approved')
on conflict do nothing;
