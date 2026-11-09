// Module 4: accounts and the staff dashboard. Database calls for sign-in and ticket handling live here.
import { sb, ok } from '../../shared/supabase.js';

// ---------- Accounts ----------
export const signUp = (email, password, fullName) =>
  sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } }).then(ok);
export const signIn = (email, password) => sb.auth.signInWithPassword({ email, password }).then(ok);
export const signOut = () => sb.auth.signOut();
export async function myProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return ok(await sb.from('profiles').select('full_name, role').eq('id', user.id).single());
}

// ---------- Tickets (staff only: the database returns nothing to anyone else) ----------
const TICKET = 'id, ticket_no, category, description, location, photo_path, reporter_name, is_anonymous, ' +
  'status, priority, assigned_to, created_at';

// UC02: every ticket, newest first. Searching and filtering (UC03) happen in the page, so they are instant.
export const listTickets = async () =>
  ok(await sb.from('tickets').select(TICKET).order('created_at', { ascending: false }));

// UC04: one ticket by its number, with its status history (oldest first). Null when there is no such ticket.
export async function getTicket(ticketNo) {
  const t = ok(await sb.from('tickets').select(TICKET).eq('ticket_no', ticketNo).maybeSingle());
  if (!t) return null;
  const history = ok(await sb.from('ticket_events').select('id, status, note, created_at')
    .eq('ticket_id', t.id).order('created_at', { ascending: true }));
  return { ...t, history };
}

// UC05 to UC07: saves the changed fields (priority, assigned_to, status) and returns the saved ticket.
// A status change is added to the history by the database itself (trigger tickets_log).
export const updateTicket = async (id, changes) =>
  ok(await sb.from('tickets').update(changes).eq('id', id).select(TICKET).single());

// Ticket photos are private. Staff get a link that works for one hour.
export async function ticketPhotoUrl(path) {
  const { data, error } = await sb.storage.from('ticket-photos').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// UC06: the people a ticket can be given to (staff accounts), sorted by name.
export const listStaff = async () =>
  ok(await sb.from('profiles').select('id, full_name, role')
    .in('role', ['admin', 'construction', 'government']).order('full_name'));

// Posting and publishing advisories belong to Module 1: saveAdvisory(), publishAdvisory(), endAdvisory().
