// Works schedule (UC04): ongoing and upcoming works grouped by area, each on a four-week timeline.
import { listSchedule } from '../api.js';
import { $, esc, todayISO, addDays, daysBetween, day, dateRange } from '../util.js';
import { onShow } from '../router.js';

const SPAN = 28; // days shown on the timeline, starting today
const pct = (days) => `${(days / SPAN) * 100}%`;

function when(a, today) {
  if (!a.starts_on || a.starts_on <= today) return '<span class="pill on">Under way</span>';
  const n = daysBetween(today, a.starts_on);
  return `<span class="pill">${n === 1 ? 'Starts tomorrow' : `Starts in ${n} days`}</span>`;
}

// The coloured bar: where the work starts and ends within the next SPAN days.
function bar(a, today) {
  const from = a.starts_on ? Math.max(0, daysBetween(today, a.starts_on)) : 0;
  if (from >= SPAN) return `<span class="sch-later">From ${esc(day(a.starts_on, false))} →</span>`;
  const openEnded = !a.ends_on || daysBetween(today, a.ends_on) >= SPAN;
  const to = openEnded ? SPAN : daysBetween(today, a.ends_on) + 1;
  const cls = `sch-fill${from === 0 ? ' on' : ''}${openEnded ? ' open' : ''}`;
  return `<span class="${cls}" style="left:${pct(from)};width:${pct(to - from)}"></span>`;
}

const scale = (today) => [0, 7, 14, 21]
  .map((n) => `<span style="left:${pct(n)}">${n ? esc(day(addDays(today, n), false)) : 'Today'}</span>`).join('');

const row = (a, today) => `<li class="sch-row">
  <div class="sch-info">
    <p>${when(a, today)} <span class="mut">${esc(a.category)}</span></p>
    <h3><button type="button" class="sch-title" data-advisory="${a.id}">${esc(a.title)}</button></h3>
    <p class="mut">${esc(dateRange(a.starts_on, a.ends_on))}${a.work_hours ? ` · ${esc(a.work_hours)}` : ''}</p>
  </div>
  <div class="sch-track" aria-hidden="true">${bar(a, today)}</div>
</li>`;

let seq = 0;
async function render() {
  const my = ++seq, today = todayISO();
  let list;
  try { list = await listSchedule({ zoneId: $('#schz').value }); } catch (e) {
    if (my !== seq) return;
    console.error(e);
    $('#schlist').innerHTML = '';
    $('#schempty').textContent = 'Could not load the schedule. Please try again later.';
    $('#schempty').hidden = false;
    return;
  }
  if (my !== seq) return;

  const groups = {};
  list.forEach((a) => { const k = a.zones ? a.zones.name : 'All areas'; (groups[k] = groups[k] || []).push(a); });
  $('#schlist').innerHTML = Object.keys(groups).sort().map((name) => `<div class="card sch-group">
  <div class="sch-row sch-head"><h2>${esc(name)} <span class="mut">(${groups[name].length})</span></h2><div class="sch-scale" aria-hidden="true">${scale(today)}</div></div>
  <ul class="sch-list">${groups[name].map((a) => row(a, today)).join('')}</ul>
</div>`).join('');
  $('#schempty').textContent = 'No ongoing or upcoming works in this area.';
  $('#schempty').hidden = list.length > 0;
}

export function init() {
  $('#schz').onchange = render;
  onShow('schedule', render);
}
