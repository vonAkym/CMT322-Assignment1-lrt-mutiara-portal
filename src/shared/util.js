// Small helpers and lists shared by several modules.
export const CATS = ['Road closure', 'Schedule', 'Business access', 'Progress'];
export const STAT = ['Submitted', 'Under review', 'In progress', 'Resolved'];
export const SEVERITY = ['Low', 'Medium', 'High'];

export const when = (d) => new Date(d).toLocaleString();

// ---------- Dates ----------
// The database stores days as 'YYYY-MM-DD'. These helpers read and write them in the visitor's local time.
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (iso) => new Date(`${iso}T00:00`);

export const todayISO = () => toISO(new Date());
export function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);

// 7 Nov 2026
export const day = (iso, withYear = true) =>
  fromISO(iso).toLocaleDateString('en-GB', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });

// "7 Nov – 15 Nov 2026", "From 7 Nov 2026" or "Dates to be confirmed"
export function dateRange(from, to) {
  if (!from && !to) return 'Dates to be confirmed';
  if (!to) return `From ${day(from)}`;
  if (!from) return `Until ${day(to)}`;
  return `${day(from, from.slice(0, 4) !== to.slice(0, 4))} – ${day(to)}`;
}

// "just now", "5 min ago", "3 hours ago", "2 days ago", then the date.
export function ago(ts) {
  const min = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return day(toISO(new Date(ts)));
}
