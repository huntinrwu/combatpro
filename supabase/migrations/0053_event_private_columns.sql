-- CombatPro — a promoter's private notes must not be readable from outside
-- the app. Scheduled and completed events are readable with the public key
-- (the public page streams live updates from them), and until now that
-- included every column: notes, matchmaking rules and who created the event.
--
-- From here the public key, and signed-in users reading the database
-- directly, can only read the columns the public page needs. The app itself
-- reads events on the server with the service role and is unaffected.
-- Columns added to events later are private until they are granted here.
revoke select on public.events from anon, authenticated;

grant select (
  id, name, slug, event_date, venue, city, state, country, promoter,
  primary_sport, event_type, status, created_at, current_bout_id,
  commission_id, sanctioning_body_id, promotion_id,
  medicals_required, registration_open, public_roster, public_bouts, public_info
) on public.events to anon, authenticated;
