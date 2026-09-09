-- CombatPro — free-text license summary on the fighter record.
--
-- One text column intentionally, so promoters/SB reps can dump whatever their
-- filing system needs: "WBC #12345 · FSBC #6789 · CSAC lic. exp 2027-03".
-- If per-body license tracking becomes friction, split into a real sub-table.

do $$ begin
  alter table public.fighters add column licenses text;
exception when duplicate_column then null; end $$;
