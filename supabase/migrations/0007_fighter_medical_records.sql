-- CombatPro — fighter medical clearances (per-fighter, per-kind).
-- Multiple rows per (fighter, kind) allowed — latest non-expired is "active".
-- Standard boxing/MMA medical set: physical, bloodwork (HIV/HepB/HepC),
-- ophthalmology, MRI/CT, EKG, neuro. Sanctioning bodies set expiry windows
-- (usually 6-12 months for bloodwork, 1 year for physical/eye, 3-5 years MRI).

create table if not exists public.fighter_medical_records (
  id uuid primary key default uuid_generate_v4(),
  fighter_id uuid not null references public.fighters(id) on delete cascade,
  kind text not null,
  issued_on date not null,
  expires_on date,
  issuing_physician text,
  issuing_facility text,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.fighter_medical_records
    add constraint fighter_medical_records_kind_check
    check (kind in ('physical','bloodwork','ophthalmology','mri','ekg','neuro'));
exception when duplicate_object then null; end $$;

create index if not exists fighter_medical_records_fighter_idx
  on public.fighter_medical_records(fighter_id);

create index if not exists fighter_medical_records_expires_idx
  on public.fighter_medical_records(expires_on);

create or replace function public.fighter_medical_records_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fighter_medical_records_touch_trg
  on public.fighter_medical_records;
create trigger fighter_medical_records_touch_trg
  before update on public.fighter_medical_records
  for each row execute function public.fighter_medical_records_touch();
