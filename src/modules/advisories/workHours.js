// Module 1: work hours of an advisory, chosen with time pickers and day boxes (UC06, UC07).
// They are saved as text in the work_hours column in one fixed format, e.g. "10:00 pm – 6:00 am, Mon–Sat" or
// "24 hours, Every day", so every page (and the map) can show them as they are, and the form can read them back.
// Text in any other format (older advisories) is shown as it is, and simply cannot be read back into the pickers.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index 0 is Monday
const DASH = ' – ';

// '22:00' -> '10:00 pm'
export function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
// '10:00 pm' -> '22:00'
function to24h(text) {
  const [, h, m, ap] = /^(\d{1,2}):(\d{2}) (am|pm)$/.exec(text);
  return `${String((+h % 12) + (ap === 'pm' ? 12 : 0)).padStart(2, '0')}:${m}`;
}

// [0,1,2,3,4,5] -> 'Mon–Sat'. Days that follow each other become a range; others are listed.
export function dayText(days) {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 7) return 'Every day';
  if (d.length > 2 && d[d.length - 1] - d[0] === d.length - 1) return `${DAYS[d[0]]}–${DAYS[d[d.length - 1]]}`;
  return d.map((i) => DAYS[i]).join(', ');
}
function readDays(text) {
  if (text === 'Every day') return [0, 1, 2, 3, 4, 5, 6];
  const range = /^(\w{3})–(\w{3})$/.exec(text);
  if (range) {
    const [a, b] = [DAYS.indexOf(range[1]), DAYS.indexOf(range[2])];
    return a >= 0 && b > a ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : null;
  }
  const list = text.split(', ').map((t) => DAYS.indexOf(t));
  return list.every((i) => i >= 0) ? list : null;
}

// { from: '22:00', to: '06:00', days: [0..6], allDay: false } -> '10:00 pm – 6:00 am, Mon–Sat'
export function formatHours({ from, to, days, allDay }) {
  return `${allDay ? '24 hours' : `${to12h(from)}${DASH}${to12h(to)}`}, ${dayText(days)}`;
}

// The opposite of formatHours. null when the text is not in that format (or empty).
export function parseHours(text) {
  const m = /^(?:(24 hours)|(\d{1,2}:\d{2} [ap]m) – (\d{1,2}:\d{2} [ap]m)), (.+)$/.exec(String(text || '').trim());
  if (!m) return null;
  const days = readDays(m[4]);
  if (!days) return null;
  return m[1] ? { from: '', to: '', days, allDay: true } : { from: to24h(m[2]), to: to24h(m[3]), days, allDay: false };
}

// Works that end at or before their start time run overnight, into the next morning.
export const overnight = (h) => !h.allDay && !!h.from && !!h.to && h.to <= h.from;

// True when the hours cover the moment `now` (a Date, local time); null when the text cannot be read.
// Overnight works count on the next morning too, when they started the evening before.
export function hoursNow(text, now = new Date()) {
  const h = parseHours(text);
  if (!h) return null;
  const today = (now.getDay() + 6) % 7; // JavaScript counts from Sunday; DAYS from Monday
  const yesterday = (today + 6) % 7;
  if (h.allDay) return h.days.includes(today);
  const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (!overnight(h)) return h.days.includes(today) && t >= h.from && t < h.to;
  return (h.days.includes(today) && t >= h.from) || (h.days.includes(yesterday) && t < h.to);
}
