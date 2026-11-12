// Module 1: Construction Advisory Hub. All database calls for advisories live here.
// Advisories are stored in the "updates" table. The public sees Published and Ended ones; drafts are staff only.
import { sb, ok, clean, isDay, checkPhoto, photoName } from '../../shared/supabase.js';
import { todayISO, addDays } from '../../shared/util.js';

const ADVISORY = 'id, title, body, category, status, severity, state, location, lat, lng, starts_on, ends_on, work_hours, ' +
  'detour, affected_businesses, photo_paths, zone_id, created_by, created_at, updated_at, zones(name)';

// The map pin (lat, lng) comes from supabase/migrations/20261113000000_advisory_location.sql. Until that has been run,
// the database refuses any query that asks for those columns, so the site then asks again without them: everything
// keeps working, just without pins. columns is what the queries ask for at the moment.
const NO_PIN = ADVISORY.replace('lat, lng, ', '');
let columns = ADVISORY;
const noColumn = (e) => !!e && e.code === '42703';
// Runs the query that make(columns) builds, and asks again without the pin when the columns are missing.
// (Several queries can be under way at once, so each checks the columns it asked for itself.)
async function query(make) {
  const asked = columns;
  const r = await make(asked);
  if (noColumn(r.error) && asked !== NO_PIN) { columns = NO_PIN; return make(NO_PIN); }
  return r;
}

// A photo is either a file in the update-photos bucket or a sample image shipped with the site (public/assets/...).
export const photoUrl = (path) =>
  /^(https?:|assets\/)/.test(path) ? path : sb.storage.from('update-photos').getPublicUrl(path).data.publicUrl;

// An advisory is over when staff end it (UC08), or by itself once its end date has passed, so the public never
// sees finished works as current even if nobody pressed End. Overdue ones still need ending by staff.
export const isOverdue = (a) => a.state === 'Published' && !!a.ends_on && a.ends_on < todayISO();
export const isOver = (a) => a.state === 'Ended' || isOverdue(a);

// UC05: an advisory is urgent when its severity is High and the works are under way or start within
// URGENT_LEAD_DAYS. High works further ahead become urgent by themselves as the start date comes closer.
// The banner, the home count, the "Urgent only" filter and the Urgent labels all use this one rule.
export const URGENT_LEAD_DAYS = 3;
export const urgentFrom = (a) => (a.starts_on ? addDays(a.starts_on, -URGENT_LEAD_DAYS) : null);
export const isUrgent = (a) => a.severity === 'High' && !isOver(a) && (!a.starts_on || urgentFrom(a) <= todayISO());

// Saving, publishing or ending an advisory announces it, so parts of the page that show advisories
// (such as the urgent banner) can load them again.
export const ADVISORIES_CHANGED = 'advisories-changed';

// UC03: current advisories (or the ended archive), most recently updated first.
// Current = published and not past the end date. Archive = ended, or published but past the end date.
// onDate keeps only advisories whose works cover that day. urgent keeps only urgent ones (see isUrgent).
export async function listAdvisories({ q, zoneId, category, status, severity, urgent, onDate, ended = false, limit } = {}) {
  return ok(await query((cols) => listQuery(cols, { q, zoneId, category, status, severity, urgent, onDate, ended, limit })));
}
function listQuery(cols, { q, zoneId, category, status, severity, urgent, onDate, ended, limit }) {
  const today = todayISO();
  let r = sb.from('updates').select(cols).order('updated_at', { ascending: false });
  r = ended
    ? r.or(`state.eq.Ended,and(state.eq.Published,ends_on.lt.${today})`)
    : r.eq('state', 'Published').or(`ends_on.is.null,ends_on.gte.${today}`);
  if (zoneId) r = r.eq('zone_id', zoneId);
  if (category) r = r.eq('category', category);
  if (status) r = r.eq('status', status);
  if (severity) r = r.eq('severity', severity);
  if (urgent) r = r.eq('severity', 'High').or(`starts_on.is.null,starts_on.lte.${addDays(today, URGENT_LEAD_DAYS)}`);
  if (isDay(onDate)) r = r.or(`starts_on.is.null,starts_on.lte.${onDate}`).or(`ends_on.is.null,ends_on.gte.${onDate}`);
  const k = q ? clean(q) : '';
  if (k) r = r.or(`title.ilike.%${k}%,body.ilike.%${k}%,location.ilike.%${k}%`);
  if (limit) r = r.limit(limit);
  return r;
}

// UC02: one advisory with all its details. Returns null if it does not exist (or is a draft you cannot see).
export const getAdvisory = async (id) =>
  ok(await query((cols) => sb.from('updates').select(cols).eq('id', id).maybeSingle()));

// UC01: today's overview, worked out from the published advisories.
export async function hubSummary() {
  const all = await listAdvisories();
  const today = todayISO(), weekEnd = addDays(today, 7);
  const ongoing = all.filter((a) => a.status === 'Ongoing');
  return {
    closures: ongoing.filter((a) => a.category === 'Road closure').length,
    active: ongoing.length,
    urgent: all.filter(isUrgent).length,
    // Works that run on at least one day of the coming week.
    thisWeek: all.filter((a) => (!a.starts_on || a.starts_on <= weekEnd) && (!a.ends_on || a.ends_on >= today)).length,
    latest: all.slice(0, 3),
  };
}

// UC05: the urgent advisories for the alert banner.
export const listUrgent = () => listAdvisories({ urgent: true });

// UC04: published works that have not finished yet, soonest first.
export async function listSchedule({ zoneId } = {}) {
  return ok(await query((cols) => {
    let r = sb.from('updates').select(cols)
      .eq('state', 'Published')
      .or(`ends_on.is.null,ends_on.gte.${todayISO()}`)
      .order('starts_on', { ascending: true, nullsFirst: true });
    if (zoneId) r = r.eq('zone_id', zoneId);
    return r;
  }));
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
// The database rules (RLS): staff post advisories; only the person who posted one, or an admin, changes it.
const NO_RIGHTS = 'The database did not allow this change. Only staff can post advisories, and only the person ' +
  'who posted an advisory or an admin can change it. Try signing out and in again.';
const refused = (e) => e && (e.code === '42501' || e.code === 'PGRST116' || /row-level security|unauthorized/i.test(e.message));

// UC07: the advisories on Manage advisories. Staff get the ones they posted. all: true gives every advisory, for admins,
// whom the database already lets change any advisory (including sample ones with nobody recorded as the author).
export async function listMyAdvisories({ all = false } = {}) {
  const { data: { user } } = await sb.auth.getUser();
  if (!all && !user) return [];
  const list = ok(await query((cols) => {
    const r = sb.from('updates').select(cols).order('updated_at', { ascending: false });
    return all ? r : r.eq('created_by', user.id);
  }));
  // Who posted each one (posted_by): staff may read each other's names. null when nobody is recorded,
  // as for the sample advisories added straight into the database. A failed lookup only loses the names.
  const ids = [...new Set(list.map((a) => a.created_by).filter(Boolean))];
  let names = {};
  if (ids.length) {
    try {
      names = Object.fromEntries(ok(await sb.from('profiles').select('id, full_name').in('id', ids)).map((p) => [p.id, p.full_name]));
    } catch (e) { console.error(e); }
  }
  return list.map((a) => ({ ...a, posted_by: a.created_by ? names[a.created_by] || 'Staff member' : null }));
}

export async function uploadAdvisoryPhoto(file) {
  checkPhoto(file);
  const path = photoName(file);
  const { error } = await sb.storage.from('update-photos').upload(path, file);
  if (error) throw refused(error) ? new Error(NO_RIGHTS) : error;
  return path;
}

// UC06 and UC07: creates an advisory when id is empty, otherwise saves the changed fields.
// A pin can only be saved once the location migration has been run (see columns above).
const NO_PIN_YET = 'The map pin could not be saved because the database has not been updated for pins yet. ' +
  'Remove the pin to save without it, or ask whoever manages the database to run the advisory location update.';
export async function saveAdvisory(id, fields) {
  const { data, error } = await query((cols) =>
    (id ? sb.from('updates').update(fields).eq('id', id) : sb.from('updates').insert(fields)).select(cols).single());
  if (error && error.code === 'PGRST204' && /'(lat|lng)'/.test(error.message)) throw new Error(NO_PIN_YET);
  if (error) throw refused(error) ? new Error(NO_RIGHTS) : error;
  window.dispatchEvent(new Event(ADVISORIES_CHANGED)); // publishing and ending come through here too
  return data;
}
export const publishAdvisory = (id) => saveAdvisory(id, { state: 'Published' });
// UC08: ending an advisory also marks its work as completed (the database requires both together).
export const endAdvisory = (id) => saveAdvisory(id, { state: 'Ended', status: 'Completed' });
