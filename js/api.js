// All calls from the web pages to Supabase live here.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ok = ({ data, error }) => { if (error) throw error; return data; };
const clean = (s) => String(s).replace(/[,()%*]/g, ' ').trim();

// ---------- Module 1: updates ----------
export const listZones = async () => ok(await sb.from('zones').select('id, name').order('name'));

export async function listUpdates({ zoneId, category, status, q } = {}) {
  let r = sb.from('updates')
    .select('id, title, body, category, status, is_urgent, created_at, zones(name)')
    .order('created_at', { ascending: false });
  if (zoneId) r = r.eq('zone_id', zoneId);
  if (category) r = r.eq('category', category);
  if (status) r = r.eq('status', status);
  if (q && clean(q)) r = r.or(`title.ilike.%${clean(q)}%,body.ilike.%${clean(q)}%`);
  return ok(await r);
}

export const subscribeToZone = async (zoneId, email) =>
  ok(await sb.from('subscriptions').insert({ zone_id: zoneId, email }));

// ---------- Module 2: map ----------
export const listMapFeatures = async () =>
  ok(await sb.from('map_features').select('*').order('kind'));

// ---------- Module 3: complaints and tracking ----------
export async function submitTicket({ category, description, location, name, anonymous, file }) {
  let photoPath = null;
  if (file) {
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024)
      throw new Error('Photo must be a JPG or PNG up to 5 MB.');
    photoPath = `${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
    const up = await sb.storage.from('ticket-photos').upload(photoPath, file);
    if (up.error) throw up.error;
  }
  return ok(await sb.rpc('submit_ticket', {
    p_category: category, p_description: description, p_location: location || null,
    p_photo_path: photoPath, p_name: name || null, p_anonymous: !!anonymous,
  })); // returns the ticket number, e.g. LRT-2026-0001
}

export const trackTicket = async (ticketNo) => ok(await sb.rpc('track_ticket', { p_ticket_no: ticketNo }));

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

// ---------- Module 4: staff only (blocked by RLS for everyone else) ----------
export const listTickets = async () =>
  ok(await sb.from('tickets').select('*').order('created_at', { ascending: false }));
export const updateTicket = async (id, changes) =>
  ok(await sb.from('tickets').update(changes).eq('id', id).select().single()); // status, priority, assigned_to
export const postUpdate = async (u) => ok(await sb.from('updates').insert(u).select().single());
export const approveUpdate = async (id) =>
  ok(await sb.from('updates').update({ approved: true }).eq('id', id));
