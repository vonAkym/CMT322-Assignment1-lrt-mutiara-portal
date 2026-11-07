-- Module 1: Construction Advisory Hub (UC01 to UC08).
-- Turns the existing "updates" table into full advisories. The table keeps its name because
-- map_features.update_id and other modules already point at it; the site calls them "advisories".
-- Run once after 20261028000000_init.sql (SQL Editor, or: npx supabase db push).

-- ---------- New columns ----------
alter table public.updates
  add column location text,
  add column starts_on date,
  add column ends_on date,
  add column work_hours text,
  add column severity text not null default 'Low' check (severity in ('Low','Medium','High')),
  add column detour text,
  add column affected_businesses text,
  add column photo_paths text[] not null default '{}',
  add column state text not null default 'Draft' check (state in ('Draft','Published','Ended')),
  add column updated_at timestamptz not null default now();

-- Carry over rows created before this migration.
update public.updates set
  state       = case when approved then 'Published' else 'Draft' end,
  severity    = case when is_urgent then 'High' else 'Low' end,
  photo_paths = case when photo_path is null then '{}' else array[photo_path] end,
  starts_on   = created_at::date,
  updated_at  = created_at;

alter table public.updates
  add constraint updates_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on),
  add constraint updates_photos_check check (cardinality(photo_paths) <= 5),
  -- An ended advisory is always a completed piece of work (UC08).
  add constraint updates_ended_check check (state <> 'Ended' or status = 'Completed');

-- The old columns are replaced by state, severity and photo_paths. The old read policy uses
-- "approved", so it has to go first.
drop policy updates_read on public.updates;
drop policy updates_staff_write on public.updates;
alter table public.updates drop column approved, drop column is_urgent, drop column photo_path;

-- ---------- Last updated time (UC02) ----------
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger updates_touch
  before update on public.updates for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Everyone sees published and ended advisories. Drafts are for staff only.
create policy updates_read on public.updates for select to anon, authenticated
  using (state <> 'Draft' or public.is_staff());

-- Staff post advisories (UC06).
create policy updates_staff_insert on public.updates for insert to authenticated
  with check (public.is_staff());

-- Staff edit and end their own advisories; admins can edit any (UC07, UC08).
-- There is no delete policy: advisories are ended, never deleted, so the public record stays.
create policy updates_staff_update on public.updates for update to authenticated
  using (public.is_staff() and (created_by = (select auth.uid()) or public.is_admin()))
  with check (public.is_staff() and (created_by = (select auth.uid()) or public.is_admin()));
