-- Module 4: the rest of Admin & Feedback Tracking.
--   * Tickets get an area (zone), chosen on the Report form, for the zone filter and figures (UC02, UC03, UC10).
--   * Each staff role may do only its own part (use case diagram, Figure 4):
--       Admin               everything: priority, assignment, escalation, status, replies, staff roles (UC05, UC06, UC09, UC12)
--       Construction Team   status and replies, on tickets assigned to the Construction Team or to them by name (UC07, UC08)
--       Government Officer  status and replies, on escalated tickets or tickets assigned to them (UC07, UC08)
--     Every staff role can still see every ticket and the dashboard (UC02, UC04, UC10, UC11).
--   * Admins list accounts and change their role and name (UC12).
-- Run once after 20261110000000_ticket_replies.sql (SQL Editor, or: npx supabase db push).

-- ---------- Area of a ticket ----------
alter table public.tickets add column zone_id smallint references public.zones(id);

-- submit_ticket gets an optional area. The old version is replaced, so there is never a choice between two.
drop function public.submit_ticket(text, text, text, text, text, boolean);
create function public.submit_ticket(
  p_category text, p_description text, p_location text default null,
  p_photo_path text default null, p_name text default null, p_anonymous boolean default false,
  p_zone_id smallint default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_no text;
begin
  insert into public.tickets (category, description, location, photo_path, reporter_name, is_anonymous, reporter_id, zone_id)
  values (
    p_category, p_description, nullif(trim(p_location), ''), p_photo_path,
    case when p_anonymous then null else nullif(trim(p_name), '') end,
    p_anonymous,
    case when p_anonymous then null else auth.uid() end,
    p_zone_id
  )
  returning ticket_no into v_no;
  return v_no;
end $$;
revoke all on function public.submit_ticket(text, text, text, text, text, boolean, smallint) from public;
grant execute on function public.submit_ticket(text, text, text, text, text, boolean, smallint) to anon, authenticated;

-- ---------- Who may handle a ticket ----------
-- The signed-in person's role and name (null for visitors).
create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select full_name from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_role() from public;
revoke all on function public.my_name() from public;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_name() to authenticated;

-- True when the signed-in staff member may change the status of, and reply to, a ticket with this assignee
-- and escalation. The website uses the same rule (src/modules/admin/tickets.js, ticketRights).
create function public.can_handle_ticket(p_assigned text, p_escalated timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'admin' then true
    when 'construction' then p_assigned = 'Construction Team' or (p_assigned is not null and p_assigned = public.my_name())
    when 'government' then p_escalated is not null or p_assigned = 'Government Officers'
                           or (p_assigned is not null and p_assigned = public.my_name())
    else false
  end;
$$;
revoke all on function public.can_handle_ticket(text, timestamptz) from public;
grant execute on function public.can_handle_ticket(text, timestamptz) to authenticated;

-- Every change to a ticket from the website is checked here, whichever way it arrives.
-- Changes made in the SQL Editor or by the system (no signed-in user) are not limited.
create function public.guard_ticket_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.priority is distinct from old.priority or new.assigned_to is distinct from old.assigned_to
     or new.escalated_at is distinct from old.escalated_at or new.escalation_reason is distinct from old.escalation_reason
     or new.zone_id is distinct from old.zone_id then
    raise exception 'Only admins can change the priority, assignment or escalation of a ticket' using errcode = '42501';
  end if;
  if not public.can_handle_ticket(old.assigned_to, old.escalated_at) then
    raise exception 'This ticket is not assigned to you' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger tickets_guard
  before update on public.tickets for each row execute function public.guard_ticket_update();

-- UC08: replies follow the same rule as status changes.
create or replace function public.reply_to_ticket(p_ticket_id bigint, p_message text) returns public.ticket_events
language plpgsql security definer set search_path = public as $$
declare v public.ticket_events; t public.tickets;
begin
  if not public.is_staff() then raise exception 'Only staff can reply to tickets' using errcode = '42501'; end if;
  select * into t from public.tickets where id = p_ticket_id;
  if t.id is null then raise exception 'No such ticket' using errcode = 'P0002'; end if;
  if not public.can_handle_ticket(t.assigned_to, t.escalated_at) then
    raise exception 'This ticket is not assigned to you' using errcode = '42501';
  end if;
  insert into public.ticket_events (ticket_id, status, kind, note, created_by)
    values (t.id, t.status, 'reply', trim(p_message), auth.uid())
    returning * into v;
  return v;
end $$;

-- UC09: only admins escalate.
create or replace function public.escalate_ticket(p_ticket_id bigint, p_reason text) returns public.tickets
language plpgsql security definer set search_path = public as $$
declare v public.tickets;
begin
  if not public.is_admin() then raise exception 'Only admins can escalate tickets' using errcode = '42501'; end if;
  update public.tickets
    set escalated_at = now(), escalation_reason = trim(p_reason), assigned_to = 'Government Officers'
    where id = p_ticket_id and escalated_at is null
    returning * into v;
  if v.id is null then raise exception 'No such ticket, or it is already escalated' using errcode = 'P0002'; end if;
  insert into public.ticket_events (ticket_id, status, kind, note, created_by)
    values (v.id, v.status, 'escalated', trim(p_reason), auth.uid());
  return v;
end $$;

-- Visitors never call the staff functions (each one also checks the role itself).
revoke execute on function public.reply_to_ticket(bigint, text) from anon;
revoke execute on function public.escalate_ticket(bigint, text) from anon;

-- ---------- Staff accounts (UC12, admins only) ----------
-- Every account with its sign-in email, which only the auth schema holds.
create function public.list_accounts()
returns table (id uuid, email text, full_name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can manage staff' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.full_name, p.role, u.created_at
    from public.profiles p join auth.users u on u.id = p.id
    order by (p.role = 'resident'), p.full_name nulls last, u.email;
end $$;
revoke all on function public.list_accounts() from public;
grant execute on function public.list_accounts() to authenticated;

-- Gives an account a role (resident means no staff access) and, optionally, the name shown when assigning tickets.
-- Admins cannot change their own role, so the site always keeps at least the admin making the change.
create function public.set_account(p_user uuid, p_role text, p_full_name text default null) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v public.profiles;
begin
  if not public.is_admin() then raise exception 'Only admins can manage staff' using errcode = '42501'; end if;
  if p_role not in ('resident','business','government','construction','admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin role' using errcode = '42501';
  end if;
  update public.profiles
    set role = p_role, full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
    where id = p_user
    returning * into v;
  if v.id is null then raise exception 'No such account' using errcode = 'P0002'; end if;
  return v;
end $$;
revoke all on function public.set_account(uuid, text, text) from public;
grant execute on function public.set_account(uuid, text, text) to authenticated;
