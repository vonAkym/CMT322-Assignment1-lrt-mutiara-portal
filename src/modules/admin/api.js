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
// Every column, so the pages keep working whether or not the newest migration (escalation) has been run.
const TICKET = '*';

// UC02: every ticket, newest first. Searching and filtering (UC03) happen in the page, so they are instant.
export const listTickets = async () =>
  ok(await sb.from('tickets').select(TICKET).order('created_at', { ascending: false }));

// UC04: one ticket by its number, with its status history (oldest first). Null when there is no such ticket.
export async function getTicket(ticketNo) {
  const t = ok(await sb.from('tickets').select(TICKET).eq('ticket_no', ticketNo).maybeSingle());
  if (!t) return null;
  const history = ok(await sb.from('ticket_events').select('*')
    .eq('ticket_id', t.id).order('created_at', { ascending: true }));
  return { ...t, history };
}

// UC05 to UC07: saves the changed fields (priority, assigned_to, status) and returns the saved ticket.
// A status change is added to the history by the database itself (trigger tickets_log).
export const updateTicket = async (id, changes) =>
  ok(await sb.from('tickets').update(changes).eq('id', id).select(TICKET).single());

// UC08: a reply the resident sees when tracking the ticket (5 to 1000 characters). Returns the history entry.
export const replyToTicket = async (id, message) =>
  ok(await sb.rpc('reply_to_ticket', { p_ticket_id: id, p_message: message.trim() }));

// UC09: hands the ticket to the government officers. The reason stays with staff; the resident only sees
// that it was passed on. Returns the updated ticket.
export const escalateTicket = async (id, reason) =>
  ok(await sb.rpc('escalate_ticket', { p_ticket_id: id, p_reason: reason.trim() }));

// UC10: every history entry of every ticket, for the response-time figures.
export const listTicketEvents = async () =>
  ok(await sb.from('ticket_events').select('ticket_id, status, kind, created_at').order('created_at'));

// UC12 (admins only): every account with its email, name and role; and changing one account's role and name.
export const listAccounts = async () => ok(await sb.rpc('list_accounts'));
export const setAccount = async (userId, role, fullName) =>
  ok(await sb.rpc('set_account', { p_user: userId, p_role: role, p_full_name: fullName?.trim() || null }));

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
