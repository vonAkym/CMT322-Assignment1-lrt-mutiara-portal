// Ticket rules shared by the dashboard and the ticket page: the lists of choices, search and filters (UC03),
// and the counts on the dashboard (UC10). No database calls here, so all of it can be tested on its own.
import { STAT } from '../../shared/util.js';
import { ROLE_NAMES } from '../../shared/staff.jsx';

// The same categories the Report form offers (and the database accepts).
export const CATEGORIES = ['Noise', 'Dust', 'Road damage', 'Safety hazard', 'Blocked access', 'Other'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const STATUSES = STAT; // Submitted, Under review, In progress, Resolved

// UC06: a ticket goes to a whole team or to one staff member. Teams first, then people by name.
export const TEAMS = ['Construction Team', 'Government Officers'];
export function assigneeOptions(staff, current) {
  const people = staff.filter((p) => p.full_name)
    .map((p) => ({ value: p.full_name, label: `${p.full_name} (${ROLE_NAMES[p.role] || p.role})` }));
  const options = [...TEAMS.map((t) => ({ value: t, label: t })), ...people];
  // Keep a value saved earlier even if that person no longer has a staff account.
  if (current && !options.some((o) => o.value === current)) options.push({ value: current, label: current });
  return options;
}

// What each staff role may do with a ticket (use case diagram, Figure 4). The database checks the same rule
// (can_handle_ticket and guard_ticket_update in migration 20261113000000_admin_complete.sql); this copy only
// decides which controls to offer.
//   manage: change priority and assignee, escalate (UC05, UC06, UC09). Admins only.
//   handle: change the status and reply to the resident (UC07, UC08). Admins on every ticket; the Construction Team
//           on tickets given to the Construction Team or to them by name; Government Officers on escalated tickets,
//           tickets given to the Government Officers, or to them by name.
export function ticketRights(profile, t) {
  const role = profile?.role, name = profile?.full_name;
  const mine = !!name && t.assigned_to === name;
  const handle = role === 'admin'
    || (role === 'construction' && (t.assigned_to === 'Construction Team' || mine))
    || (role === 'government' && (!!t.escalated_at || t.assigned_to === 'Government Officers' || mine));
  return { manage: role === 'admin', handle };
}

// Which tickets a staff member sees at all: admins every ticket; the Construction Team and Government Officers only
// the tickets they may work on (handle above). The database applies the same rule
// (supabase/migrations/20261114000000_staff_own_tickets.sql).
export const visibleTickets = (list, profile) =>
  (profile?.role === 'admin' ? list : list.filter((t) => ticketRights(profile, t).handle));

// UC03: the filters, read from the page address (e.g. #/admin?status=Submitted&zone=2).
export const FILTER_KEYS = ['q', 'category', 'zone', 'status', 'priority', 'assigned', 'escalated'];
export const readFilters = (params) => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));

// Keyword search covers the ticket number, description, location and reporter name.
// zone = 'none' keeps tickets without an area; assigned = 'none' keeps unassigned tickets, and assigned = 'mine'
// keeps the tickets the signed-in person may work on (needs profile); escalated = '1' keeps escalated tickets (UC09).
export function filterTickets(list, f, profile) {
  const words = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((t) => {
    if (f.category && t.category !== f.category) return false;
    if (f.zone === 'none' ? t.zone_id != null : f.zone && String(t.zone_id) !== f.zone) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.escalated && !t.escalated_at) return false;
    if (f.assigned === 'mine') { if (!ticketRights(profile, t).handle) return false; }
    else if (f.assigned === 'none' ? !!t.assigned_to : f.assigned && t.assigned_to !== f.assigned) return false;
    const text = [t.ticket_no, t.description, t.location, t.reporter_name].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

// UC10 (first part): how many tickets per status, per category and per priority.
export function countBy(list, key, keys) {
  const counts = Object.fromEntries((keys || []).map((k) => [k, 0]));
  list.forEach((t) => { counts[t[key]] = (counts[t[key]] || 0) + 1; });
  return counts;
}

// UC08 and UC09: a reply or an escalation reason must say something, but not an essay (same limits as the database).
export const NOTE_MIN = 5;
export const NOTE_MAX = 1000;
export function checkNote(text, what) {
  const n = text.trim().length;
  if (n < NOTE_MIN) return `Write the ${what} (at least ${NOTE_MIN} characters).`;
  if (n > NOTE_MAX) return `Keep the ${what} under ${NOTE_MAX} characters.`;
  return '';
}

// A history entry as staff see it: what happened, and the note that goes with it.
export function historyItem(h) {
  if (h.kind === 'reply') return { title: 'Reply to resident', note: h.note };
  if (h.kind === 'escalated') return { title: 'Escalated to the government', note: h.note ? `Reason: ${h.note}` : null };
  return { title: h.status, note: h.note };
}

// Plain words for a failed staff action. "Function not found" means the UC08/UC09 migration has not been run yet.
export function actionError(e, what) {
  if (e?.code === 'PGRST202' || /could not find the function/i.test(e?.message || '')) {
    return `Could not ${what}: the database needs the latest update (supabase/migrations/20261110000000_ticket_replies.sql).`;
  }
  // A refusal from the role rules (e.g. "This ticket is not assigned to you") or a missing ticket: say why.
  if ((e?.code === 'P0002' || e?.code === '42501') && e.message) return `Could not ${what}: ${e.message}.`;
  return `Could not ${what}. Please try again.`;
}

// "9 Nov 2026, 14:05" in the visitor's time zone.
export const submittedAt = (ts) => new Date(ts).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// The person shown on a ticket: their name, "Anonymous", or "Not given".
export const reporter = (t) => (t.is_anonymous ? 'Anonymous' : t.reporter_name || 'Not given');

// ---------- UC10: response time ----------
// A ticket's first response is the first history entry after it was sent that shows the team acting on it:
// a status other than Submitted, a reply, or an escalation. Returns the time in milliseconds, or null if none yet.
export function firstResponse(t, events) {
  const start = new Date(t.created_at).getTime();
  const acted = events
    .filter((e) => e.ticket_id === t.id && (e.kind === 'reply' || e.kind === 'escalated' || e.status !== 'Submitted'))
    .map((e) => new Date(e.created_at).getTime())
    .filter((at) => at >= start);
  return acted.length ? Math.min(...acted) - start : null;
}

// The average first response over the tickets that have one, and how many are still waiting for one.
export function responseStats(tickets, events) {
  const times = tickets.map((t) => firstResponse(t, events)).filter((ms) => ms !== null);
  return {
    average: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    answered: times.length,
    waiting: tickets.length - times.length,
  };
}

// "45 min", "5.5 h", "2.3 days", or "–" when there is nothing to measure.
export function duration(ms) {
  if (ms == null) return '–';
  const min = ms / 60000;
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}

// ---------- UC11: summary report ----------
// One CSV cell: quoted when it holds a comma, quote or line break, with quotes doubled.
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(cell).join(',')).join('\r\n');

// The summary report: when it was made and for which filters, the dashboard figures, then one row per ticket.
// Opens in Excel or Google Sheets. zoneName(id) gives an area's name.
export function summaryReport({ tickets, events, zoneName, filters = {}, now = new Date() }) {
  const shown = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ') || 'none';
  const resp = responseStats(tickets, events);
  const section = (title, counts) => [[], [title, 'Tickets'], ...Object.entries(counts).map(([k, n]) => [k, n])];
  const zones = {};
  tickets.forEach((t) => { const z = zoneName(t.zone_id); zones[z] = (zones[z] || 0) + 1; });
  return toCsv([
    ['MutiaraInfo ticket summary report'],
    ['Generated', submittedAt(now)],
    ['Filters', shown],
    ['Tickets', tickets.length],
    ['Average first response', duration(resp.average)],
    ['Waiting for a first response', resp.waiting],
    ['Escalated to the government', tickets.filter((t) => t.escalated_at).length],
    ...section('By status', countBy(tickets, 'status', STATUSES)),
    ...section('By category', countBy(tickets, 'category', CATEGORIES)),
    ...section('By priority', countBy(tickets, 'priority', PRIORITIES)),
    ...section('By area', zones),
    [],
    ['Ticket', 'Submitted', 'Category', 'Area', 'Location', 'Priority', 'Status', 'Assigned to', 'Escalated', 'First response', 'Description'],
    ...tickets.map((t) => [
      t.ticket_no, submittedAt(t.created_at), t.category, zoneName(t.zone_id), t.location || '', t.priority, t.status,
      t.assigned_to || 'Unassigned', t.escalated_at ? 'Yes' : 'No', duration(firstResponse(t, events)), t.description,
    ]),
  ]);
}
