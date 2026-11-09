// Module 1: Construction Advisory Hub. All database calls for advisories live here.
// Advisories are stored in the "updates" table. The public sees Published and Ended ones; drafts are staff only.
import { sb, ok, clean, isDay, checkPhoto, photoName } from '../../shared/supabase.js';
import { todayISO, addDays } from '../../shared/util.js';

const ADVISORY = 'id, title, body, category, status, severity, state, location, starts_on, ends_on, work_hours, ' +
  'detour, affected_businesses, photo_paths, zone_id, created_by, created_at, updated_at, zones(name)';

// A photo is either a file in the update-photos bucket or a sample image shipped with the site (public/assets/...).
export const photoUrl = (path) =>
  /^(https?:|assets\/)/.test(path) ? path : sb.storage.from('update-photos').getPublicUrl(path).data.publicUrl;

// An advisory is over when staff end it (UC08), or by itself once its end date has passed, so the public never
// sees finished works as current even if nobody pressed End. Overdue ones still need ending by staff.
export const isOverdue = (a) => a.state === 'Published' && !!a.ends_on && a.ends_on < todayISO();
export const isOver = (a) => a.state === 'Ended' || isOverdue(a);

// UC03: current advisories (or the ended archive), most recently updated first.
// Current = published and not past the end date. Archive = ended, or published but past the end date.
// onDate keeps only advisories whose works cover that day.
export async function listAdvisories({ q, zoneId, category, status, severity, onDate, ended = false, limit } = {}) {
  const today = todayISO();
  let r = sb.from('updates').select(ADVISORY).order('updated_at', { ascending: false });
  r = ended
    ? r.or(`state.eq.Ended,and(state.eq.Published,ends_on.lt.${today})`)
    : r.eq('state', 'Published').or(`ends_on.is.null,ends_on.gte.${today}`);
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

// Zone alerts: the same check the database makes on subscriptions.email.
export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s).trim());

// Zone alerts: saves an email for one area. Returns 'added', or 'already' when that email already follows the area
// (the table allows each pair once; visitors cannot read the list back, only staff can).
export async function subscribeToZone(zoneId, email) {
  const { error } = await sb.from('subscriptions').insert({ zone_id: +zoneId, email: String(email).trim().toLowerCase() });
  if (!error) return 'added';
  if (error.code === '23505') return 'already';
  throw error;
}

// ---------- Staff only (UC06 to UC08) ----------
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
  const path = photoName(file);
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
