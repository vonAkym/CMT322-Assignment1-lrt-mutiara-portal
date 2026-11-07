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

// ---------- Staff only (blocked by RLS for everyone else) ----------
export const listTickets = async () =>
  ok(await sb.from('tickets').select('*').order('created_at', { ascending: false }));
export const updateTicket = async (id, changes) =>
  ok(await sb.from('tickets').update(changes).eq('id', id).select().single()); // status, priority, assigned_to
// Posting and publishing advisories belong to Module 1: saveAdvisory(), publishAdvisory(), endAdvisory().
