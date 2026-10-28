-- MutiaraInfo database schema (CMT322 group project)
-- Run once in the Supabase SQL Editor, or with: npx supabase db push

-- ---------- Tables ----------
create table public.zones (
  id smallint generated always as identity primary key,
  name text not null unique
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'resident'
    check (role in ('resident','business','government','construction','admin')),
  created_at timestamptz not null default now()
);

create table public.updates (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 150),
  body text not null default '',
  zone_id smallint references public.zones(id),
  category text not null check (category in ('Road closure','Schedule','Business access','Progress')),
  status text not null default 'Planned' check (status in ('Planned','Ongoing','Completed')),
  is_urgent boolean not null default false,
  approved boolean not null default false,
  photo_path text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.map_features (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('station','closure','walk','detour','biz')),
  name text not null,
  status text not null default 'Open',
  detail text not null default '',
  lat double precision not null,
  lng double precision not null,
  path jsonb,                       -- optional list of [lat, lng] points
  starts_on date,
  ends_on date,
  update_id bigint references public.updates(id) on delete set null
);

create sequence public.ticket_seq;

create table public.tickets (
  id bigint generated always as identity primary key,
  ticket_no text not null unique,
  category text not null check (category in ('Noise','Dust','Road damage','Safety hazard','Blocked access','Other')),
  description text not null check (char_length(description) between 5 and 2000),
  location text,
  photo_path text,
  reporter_name text,
  is_anonymous boolean not null default false,
  reporter_id uuid references auth.users(id),
  status text not null default 'Submitted' check (status in ('Submitted','Under review','In progress','Resolved')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  assigned_to text,
  created_at timestamptz not null default now()
);

create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.tickets(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id bigint generated always as identity primary key,
  zone_id smallint not null references public.zones(id),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  unique (zone_id, email)
);

-- ---------- Helper functions and triggers ----------
create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('government','construction','admin')
  );
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create function public.set_ticket_no() returns trigger
language plpgsql as $$
begin
  new.ticket_no := 'LRT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ticket_seq')::text, 4, '0');
  return new;
end $$;
create trigger tickets_set_no
  before insert on public.tickets for each row execute function public.set_ticket_no();

create function public.log_ticket_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.ticket_events (ticket_id, status) values (new.id, new.status);
  end if;
  return new;
end $$;
create trigger tickets_log
  after insert or update on public.tickets for each row execute function public.log_ticket_status();

-- ---------- Public functions (called with supabase.rpc) ----------
-- Anyone can submit a ticket and get its number back.
create function public.submit_ticket(
  p_category text, p_description text, p_location text default null,
  p_photo_path text default null, p_name text default null, p_anonymous boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare v_no text;
begin
  insert into public.tickets (category, description, location, photo_path, reporter_name, is_anonymous, reporter_id)
  values (
    p_category, p_description, nullif(trim(p_location), ''), p_photo_path,
    case when p_anonymous then null else nullif(trim(p_name), '') end,
    p_anonymous,
    case when p_anonymous then null else auth.uid() end
  )
  returning ticket_no into v_no;
  return v_no;
end $$;
revoke all on function public.submit_ticket(text,text,text,text,text,boolean) from public;
grant execute on function public.submit_ticket(text,text,text,text,text,boolean) to anon, authenticated;

-- Anyone with a ticket number can see its status and history (nothing else).
create function public.track_ticket(p_ticket_no text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ticket_no', t.ticket_no, 'category', t.category, 'location', t.location,
    'status', t.status, 'assigned_to', t.assigned_to, 'created_at', t.created_at,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.created_at)
      from public.ticket_events e where e.ticket_id = t.id
    ), '[]'::jsonb)
  )
  from public.tickets t
  where t.ticket_no = upper(trim(p_ticket_no));
$$;
revoke all on function public.track_ticket(text) from public;
grant execute on function public.track_ticket(text) to anon, authenticated;

-- ---------- Row Level Security ----------
alter table public.zones enable row level security;
alter table public.profiles enable row level security;
alter table public.updates enable row level security;
alter table public.map_features enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.subscriptions enable row level security;

create policy zones_read on public.zones for select to anon, authenticated using (true);

create policy updates_read on public.updates for select to anon, authenticated
  using (approved or public.is_staff());
create policy updates_staff_write on public.updates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy map_read on public.map_features for select to anon, authenticated using (true);
create policy map_staff_write on public.map_features for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- No public access to tickets: use submit_ticket and track_ticket instead.
create policy tickets_read on public.tickets for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_staff());
create policy tickets_staff_update on public.tickets for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy events_staff_read on public.ticket_events for select to authenticated
  using (public.is_staff());

create policy subs_insert on public.subscriptions for insert to anon, authenticated with check (true);
create policy subs_staff_read on public.subscriptions for select to authenticated using (public.is_staff());

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Users may change their own name only, never their role.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ticket-photos', 'ticket-photos', false, 5242880, array['image/jpeg','image/png']),
  ('update-photos', 'update-photos', true,  5242880, array['image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "anyone uploads ticket photos" on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'ticket-photos');
create policy "staff read ticket photos" on storage.objects for select
  to authenticated using (bucket_id = 'ticket-photos' and public.is_staff());
create policy "staff manage update photos" on storage.objects for all
  to authenticated using (bucket_id = 'update-photos' and public.is_staff())
  with check (bucket_id = 'update-photos' and public.is_staff());
