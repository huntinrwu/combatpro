-- CombatPro — bout class (pro vs amateur) + fighter-record idempotency tracking
-- + one-time backfill for already-declared bouts (so their records are counted
-- once and never double-applied by the app-side reverse/apply logic).

alter table public.bouts
  add column if not exists bout_class text not null default 'pro';

do $$ begin
  alter table public.bouts
    add constraint bouts_bout_class_check check (bout_class in ('pro','amateur'));
exception when duplicate_object then null; end $$;

alter table public.bouts
  add column if not exists records_applied boolean not null default false;

-- Backfill: any bout already declared (result set) but not yet marked applied
-- gets its impact written to the corresponding fighter columns exactly once.
do $$
declare
  b record;
  wcol text;
  lcol text;
  dcol text;
begin
  for b in
    select id, red_corner_fighter_id, blue_corner_fighter_id, result, bout_class
    from public.bouts
    where result is not null and records_applied = false
  loop
    if b.bout_class = 'pro' then
      wcol := 'pro_wins'; lcol := 'pro_losses'; dcol := 'pro_draws';
    else
      wcol := 'am_wins';  lcol := 'am_losses';  dcol := 'am_draws';
    end if;

    if b.result = 'red' then
      if b.red_corner_fighter_id is not null then
        execute format('update public.fighters set %I = %I + 1 where id = $1', wcol, wcol)
          using b.red_corner_fighter_id;
      end if;
      if b.blue_corner_fighter_id is not null then
        execute format('update public.fighters set %I = %I + 1 where id = $1', lcol, lcol)
          using b.blue_corner_fighter_id;
      end if;
    elsif b.result = 'blue' then
      if b.blue_corner_fighter_id is not null then
        execute format('update public.fighters set %I = %I + 1 where id = $1', wcol, wcol)
          using b.blue_corner_fighter_id;
      end if;
      if b.red_corner_fighter_id is not null then
        execute format('update public.fighters set %I = %I + 1 where id = $1', lcol, lcol)
          using b.red_corner_fighter_id;
      end if;
    elsif b.result = 'draw' then
      if b.red_corner_fighter_id is not null then
        execute format('update public.fighters set %I = %I + 1 where id = $1', dcol, dcol)
          using b.red_corner_fighter_id;
      end if;
      if b.blue_corner_fighter_id is not null then
        execute format('update public.fighters set %I = %I + 1 where id = $1', dcol, dcol)
          using b.blue_corner_fighter_id;
      end if;
    end if;
    -- no_contest: no record impact

    update public.bouts set records_applied = true where id = b.id;
  end loop;
end $$;
