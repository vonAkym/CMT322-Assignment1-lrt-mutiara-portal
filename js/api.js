// All calls from the web pages to Supabase live here.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { todayISO, addDays } from './util.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ok = ({ data, error }) => { if (error) throw error; return data; };
const clean = (s) => String(s).replace(/[,()%*]/g, ' ').trim();
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// Both photo uploads (complaints and advisories) accept the same files.
function checkPhoto(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024)
    throw new Error('Photo must be a JPG or PNG up to 5 MB.');
}

// ---------- Module 1: Construction Advisory Hub ----------
// Advisories are stored in the "updates" table. The public sees Published and Ended ones; drafts are staff only.
const ADVISORY = 'id, title, body, category, status, severity, state, location, starts_on, ends_on, work_hours, ' +
  'detour, affected_businesses, photo_paths, zone_id, created_by, created_at, updated_at, zones(name)';

export const listZones = async () => ok(await sb.from('zones').select('id, name').order('name'));

// A photo is either a file in the update-photos bucket or a sample image shipped with the site (assets/...).
export const photoUrl = (path) =>
  /^(https?:|assets\/)/.test(path) ? path : sb.storage.from('update-photos').getPublicUrl(path).data.publicUrl;

// UC03: published advisories (or the ended archive), most recently updated first.
// onDate keeps only advisories whose works cover that day.
export async function listAdvisories({ q, zoneId, category, status, severity, onDate, ended = false, limit } = {}) {
  let r = sb.from('updates').select(ADVISORY)
    .eq('state', ended ? 'Ended' : 'Published')
    .order('updated_at', { ascending: false });
  if (zoneId) r = r.eq('zone_id', zoneId);
  if (category) r = r.eq('category', category);
  if (status) r = r.eq('status', status);
  if (severity) r = r.eq('severity', severity);
  if (isDay(onDate)) r = r.or(`starts_on.is.null,starts_on.lte.${onDate}`).or(`ends_on.is.null,ends_on.gte.${onDate}`);
  const k = q ? clean(q) : '';
  if (k) r = r.or(`title.ilike.%${k}%,body.ilike.%${k}%,location.ilike.%${k}%`);
  if (limit) r = r.limit(limit);
  return ok(await r);
}

// UC02: one advisory with all its details. Returns null if it does not exist (or is a draft you cannot see).
export const getAdvisory = async (id) =>
  ok(await sb.from('updates').select(ADVISORY).eq('id', id).maybeSingle());

// UC01: today's overview, worked out from the published advisories.
export async function hubSummary() {
  const all = await listAdvisories();
  const today = todayISO(), weekEnd = addDays(today, 7);
  const ongoing = all.filter((a) => a.status === 'Ongoing');
  return {
    closures: ongoing.filter((a) => a.category === 'Road closure').length,
    active: ongoing.length,
    urgent: all.filter((a) => a.severity === 'High').length,
    // Works that run on at least one day of the coming week.
    thisWeek: all.filter((a) => (!a.starts_on || a.starts_on <= weekEnd) && (!a.ends_on || a.ends_on >= today)).length,
    latest: all.slice(0, 3),
  };
}

// UC05: high-severity advisories for the alert banner.
export const listUrgent = () => listAdvisories({ severity: 'High' });

// UC04: published works that have not finished yet, soonest first.
export async function listSchedule({ zoneId } = {}) {
  let r = sb.from('updates').select(ADVISORY)
    .eq('state', 'Published')
    .or(`ends_on.is.null,ends_on.gte.${todayISO()}`)
    .order('starts_on', { ascending: true, nullsFirst: true });
  if (zoneId) r = r.eq('zone_id', zoneId);
  return ok(await r);
}

// ---------- Module 1, staff only (UC06 to UC08) ----------
// Until staff sign-in exists, the database refuses these unless supabase/dev/demo_without_signin.sql was run.
const NO_RIGHTS = 'The database did not allow this change. Staff sign-in is not connected yet: run ' +
  'supabase/dev/demo_without_signin.sql in Supabase to try it without signing in.';
const refused = (e) => e && (e.code === '42501' || e.code === 'PGRST116' || /row-level security|unauthorized/i.test(e.message));

// Signed-in staff see their own advisories. Without sign-in (demo mode) everyone's are shown.
export async function listMyAdvisories() {
  const { data: { user } } = await sb.auth.getUser();
  let r = sb.from('updates').select(ADVISORY).order('updated_at', { ascending: false });
  if (user) r = r.eq('created_by', user.id);
  return ok(await r);
}

export async function uploadAdvisoryPhoto(file) {
  checkPhoto(file);
  const path = `${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
  const { error } = await sb.storage.from('update-photos').upload(path, file);
  if (error) throw refused(error) ? new Error(NO_RIGHTS) : error;
  return path;
}

// UC06 and UC07: creates an advisory when id is empty, otherwise saves the changed fields.
export async function saveAdvisory(id, fields) {
  const q = id ? sb.from('updates').update(fields).eq('id', id) : sb.from('updates').insert(fields);
  const { data, error } = await q.select(ADVISORY).single();
  if (error) throw refused(error) ? new Error(NO_RIGHTS) : error;
  return data;
}
export const publishAdvisory = (id) => saveAdvisory(id, { state: 'Published' });
// UC08: ending an advisory also marks its work as completed (the database requires both together).
export const endAdvisory = (id) => saveAdvisory(id, { state: 'Ended', status: 'Completed' });

export const subscribeToZone = async (zoneId, email) =>
  ok(await sb.from('subscriptions').insert({ zone_id: zoneId, email }));

// ---------- Module 2: map ----------
export const listMapFeatures = async () =>
  ok(await sb.from('map_features').select('*').order('kind'));

// ---------- Module 3: complaints and tracking ----------
export async function submitTicket({ category, description, location, name, anonymous, file }) {
  let photoPath = null;
  if (file) {
    checkPhoto(file);
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
// Posting and publishing advisories moved to Module 1: saveAdvisory(), publishAdvisory(), endAdvisory().
