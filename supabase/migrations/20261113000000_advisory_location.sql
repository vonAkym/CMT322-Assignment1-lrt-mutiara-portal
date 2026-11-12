-- Module 1: the place of each advisory on the map (UC02, UC06, UC07).
-- Staff drop a pin on a map when posting an advisory; the advisory page then shows it on a small map.
-- Both columns are optional, so older advisories (and other modules) keep working without a pin.
-- Run once after 20261108000000_advisories.sql (SQL Editor, or: npx supabase db push).

alter table public.updates
  add column lat double precision,
  add column lng double precision;

-- A pin has both numbers or neither, and lies in Penang (the same box the map is limited to).
alter table public.updates
  add constraint updates_pin_check check (
    (lat is null and lng is null)
    or (lat between 5.17 and 5.53 and lng between 100.14 and 100.5)
  );
