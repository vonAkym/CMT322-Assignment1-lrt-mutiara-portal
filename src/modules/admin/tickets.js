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

// UC03: the filters, read from the page address (e.g. #/admin?status=Submitted&priority=High).
export const FILTER_KEYS = ['q', 'category', 'status', 'priority', 'assigned', 'escalated'];
export const readFilters = (params) => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));

// Keyword search covers the ticket number, description, location and reporter name.
// assigned = 'none' keeps only unassigned tickets; escalated = '1' keeps only tickets passed to the government (UC09).
export function filterTickets(list, f) {
  const words = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((t) => {
    if (f.category && t.category !== f.category) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.escalated && !t.escalated_at) return false;
    if (f.assigned === 'none' ? !!t.assigned_to : f.assigned && t.assigned_to !== f.assigned) return false;
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
  if (e?.code === 'P0002') return `Could not ${what}: ${e.message}.`;
  return `Could not ${what}. Please try again.`;
}

// "9 Nov 2026, 14:05" in the visitor's time zone.
export const submittedAt = (ts) => new Date(ts).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// The person shown on a ticket: their name, "Anonymous", or "Not given".
export const reporter = (t) => (t.is_anonymous ? 'Anonymous' : t.reporter_name || 'Not given');
