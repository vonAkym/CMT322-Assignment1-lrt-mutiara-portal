-- Module 4: the Construction Team and Government Officers only see the complaints given to them.
-- Admins still see every ticket. A signed-in resident still sees their own tickets.
-- "Given to them" is the same rule as for changing a ticket (can_handle_ticket in 20261113000000_admin_complete.sql):
--   Construction Team: tickets assigned to "Construction Team" or to them by name.
--   Government Officers: escalated tickets, tickets assigned to "Government Officers", or to them by name.
-- The website applies the same rule (visibleTickets in src/modules/admin/tickets.js).
-- Run once after 20261113010000_advisory_location.sql (SQL Editor, or: npx supabase db push).

drop policy tickets_read on public.tickets;
create policy tickets_read on public.tickets for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or public.my_role() = 'admin'
    or (public.is_staff() and public.can_handle_ticket(assigned_to, escalated_at))
  );

-- A ticket's history follows the ticket: staff see the history of the tickets they can see.
drop policy events_staff_read on public.ticket_events;
create policy events_staff_read on public.ticket_events for select to authenticated
  using (
    public.my_role() = 'admin'
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_events.ticket_id
        and public.is_staff() and public.can_handle_ticket(t.assigned_to, t.escalated_at)
    )
  );
