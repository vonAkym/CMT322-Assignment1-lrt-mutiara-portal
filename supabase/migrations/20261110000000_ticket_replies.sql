-- Module 4: reply to resident (UC08) and escalate ticket (UC09).
-- Ticket history entries get a kind: a status change, a reply the resident can read, or an escalation.
-- Run once after 20261108000000_advisories.sql (SQL Editor, or: npx supabase db push).

-- ---------- History entries ----------
alter table public.ticket_events
  add column kind text not null default 'status' check (kind in ('status','reply','escalated')),
  add column created_by uuid references auth.users(id) default auth.uid();

alter table public.ticket_events
  add constraint ticket_events_note_check check (
    (kind = 'status') or (note is not null and char_length(trim(note)) between 5 and 1000)
  );

-- ---------- Escalation ----------
alter table public.tickets
  add column escalated_at timestamptz,
  add column escalation_reason text;

-- ---------- Staff actions (called with supabase.rpc) ----------
-- Only staff may call these; they write the history entry and the ticket change together.

-- UC08: a reply the resident sees when tracking the ticket. Returns the new history entry.
create function public.reply_to_ticket(p_ticket_id bigint, p_message text) returns public.ticket_events
language plpgsql security definer set search_path = public as $$
declare v public.ticket_events;
begin
  if not public.is_staff() then raise exception 'Only staff can reply to tickets' using errcode = '42501'; end if;
  insert into public.ticket_events (ticket_id, status, kind, note, created_by)
  select t.id, t.status, 'reply', trim(p_message), auth.uid() from public.tickets t where t.id = p_ticket_id
  returning * into v;
  if v.id is null then raise exception 'No such ticket' using errcode = 'P0002'; end if;
  return v;
end $$;
revoke all on function public.reply_to_ticket(bigint, text) from public;
grant execute on function public.reply_to_ticket(bigint, text) to authenticated;

-- UC09: passes the ticket to the government officers, with the reason (kept for staff only).
create function public.escalate_ticket(p_ticket_id bigint, p_reason text) returns public.tickets
language plpgsql security definer set search_path = public as $$
declare v public.tickets;
begin
  if not public.is_staff() then raise exception 'Only staff can escalate tickets' using errcode = '42501'; end if;
  update public.tickets
    set escalated_at = now(), escalation_reason = trim(p_reason), assigned_to = 'Government Officers'
    where id = p_ticket_id and escalated_at is null
    returning * into v;
  if v.id is null then raise exception 'No such ticket, or it is already escalated' using errcode = 'P0002'; end if;
  insert into public.ticket_events (ticket_id, status, kind, note, created_by)
    values (v.id, v.status, 'escalated', trim(p_reason), auth.uid());
  return v;
end $$;
revoke all on function public.escalate_ticket(bigint, text) from public;
grant execute on function public.escalate_ticket(bigint, text) to authenticated;

-- ---------- Public tracking ----------
-- Residents now also see the team's replies, and that the ticket went to the government
-- (but not the internal reason). Same function name and shape as before, plus kind and note.
create or replace function public.track_ticket(p_ticket_no text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ticket_no', t.ticket_no, 'category', t.category, 'location', t.location,
    'status', t.status, 'assigned_to', t.assigned_to, 'created_at', t.created_at,
    'escalated', t.escalated_at is not null,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', e.status, 'at', e.created_at, 'kind', e.kind,
        'note', case when e.kind = 'reply' then e.note end
      ) order by e.created_at)
      from public.ticket_events e where e.ticket_id = t.id
    ), '[]'::jsonb)
  )
  from public.tickets t
  where t.ticket_no = upper(trim(p_ticket_no));
$$;
