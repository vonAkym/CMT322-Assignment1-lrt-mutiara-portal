// Advisory detail page (UC02) and the advisory card used on the home and advisories pages.
// Any element with data-advisory="<id>" opens that advisory when clicked.
import { getAdvisory, photoUrl } from '../api.js';
import { $, esc, dateRange, ago } from '../util.js';
import { show, onShow } from '../router.js';
import { icon } from '../icons.js';
import { prefill } from './report.js';

// Plain text from the database, with its line breaks kept.
const para = (s) => (s ? esc(s).replace(/\n/g, '<br>') : '');
const where = (a) => a.location || (a.zones && a.zones.name) || 'Location to be confirmed';

// The labels shown on a card's photo: urgent first, then where the work stands.
function tags(a) {
  const urgent = a.severity === 'High' && a.state !== 'Ended' ? '<span class="tag hot">Urgent</span>' : '';
  return urgent + `<span class="tag">${esc(a.state === 'Ended' ? 'Ended' : a.status)}</span>`;
}

function picture(a) {
  const first = a.photo_paths && a.photo_paths[0];
  return first
    ? `<img src="${esc(photoUrl(first))}" alt="" loading="lazy">`
    : `<span class="acard-ph">${icon(a.category, 44)}</span>`;
}

export function card(a) {
  return `<article class="acard">
  <div class="acard-img">${picture(a)}<span class="acard-tags">${tags(a)}</span><span class="tag acard-type">${esc(a.category)}</span></div>
  <div class="acard-body">
    <p class="acard-meta">${icon('pin', 15)}<span>${esc(where(a))}</span></p>
    <h3><button type="button" class="acard-link" data-advisory="${a.id}">${esc(a.title)}</button></h3>
    <p class="mut clamp">${esc(a.body)}</p>
    <p class="acard-foot"><span>${icon('calendar', 15)} ${esc(dateRange(a.starts_on, a.ends_on))}</span><span>Updated ${esc(ago(a.updated_at))}</span></p>
  </div>
</article>`;
}

function gallery(a) {
  const photos = a.photo_paths || [];
  if (!photos.length) return '';
  const alt = (i) => esc(`${a.title}, photo ${i + 1} of ${photos.length}`);
  const thumbs = photos.length < 2 ? '' : `<div class="gal-thumbs">${photos.map((p, i) =>
    `<button type="button" data-photo="${i}" aria-label="Show photo ${i + 1}"${i ? '' : ' aria-pressed="true"'}><img src="${esc(photoUrl(p))}" alt=""></button>`).join('')}</div>`;
  return `<div class="gal"><img class="gal-main" id="agimg" src="${esc(photoUrl(photos[0]))}" alt="${alt(0)}">${thumbs}</div>`;
}

const fact = (label, value) => value ? `<dt>${label}</dt><dd>${value}</dd>` : '';

function render(a) {
  const pill = a.state === 'Ended' ? 'dn' : a.status === 'Ongoing' ? 'on' : '';
  return `<div class="adv-head">
  <p>${a.severity === 'High' && a.state !== 'Ended' ? '<span class="pill hot">Urgent</span> ' : ''}<span class="pill ${pill}">${esc(a.state === 'Ended' ? 'Ended' : a.status)}</span> <span class="pill">${esc(a.category)}</span></p>
  <h1>${esc(a.title)}</h1>
  <p class="mut adv-sub">${icon('pin', 16)} ${esc(where(a))} <span aria-hidden="true">·</span> Updated <time datetime="${esc(a.updated_at)}">${esc(ago(a.updated_at))}</time></p>
</div>
<div class="adv">
  <div class="stack">
    ${gallery(a)}
    <div class="card"><h2>About these works</h2><p>${para(a.body) || '<span class="mut">No further details yet.</span>'}</p></div>
    ${a.detour ? `<div class="card"><h2>Detour and access</h2><p>${para(a.detour)}</p></div>` : ''}
    ${a.affected_businesses ? `<div class="card"><h2>Affected businesses</h2><p>${para(a.affected_businesses)}</p></div>` : ''}
  </div>
  <aside class="stack">
    <div class="card"><h2>Key facts</h2><dl class="facts">
      ${fact('Dates', esc(dateRange(a.starts_on, a.ends_on)))}
      ${fact('Work hours', esc(a.work_hours || 'To be confirmed'))}
      ${fact('Area', esc(a.zones ? a.zones.name : 'All areas'))}
      ${fact('Location', a.location && esc(a.location))}
      ${fact('Severity', esc(a.severity))}
      ${fact('Last updated', esc(new Date(a.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })))}
    </dl></div>
    <div class="card stack"><h2>Something wrong near these works?</h2>
      <p class="mut">Tell the team about noise, dust, damage or blocked access and get a ticket number.</p>
      <button type="button" class="btn" id="arep">Report an issue here</button>
      <button type="button" class="btn s" id="amap">Open the disruption map</button>
    </div>
  </aside>
</div>`;
}

let current = null, seq = 0;
async function open(id) {
  const my = ++seq;
  $('#adet').innerHTML = '<p class="mut" style="padding:40px 0">Loading advisory…</p>';
  let a = null;
  try { a = await getAdvisory(id); } catch (e) { console.error(e); }
  if (my !== seq) return; // another advisory was opened meanwhile
  current = a;
  $('#adet').innerHTML = a ? render(a)
    : '<div class="card" style="margin:20px 0 28px"><h2>This advisory is not available</h2><p class="mut">It may have been removed, or the connection failed. Please go back to the list and try again.</p></div>';
}

export function init() {
  // Cards on any page open the detail page.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-advisory]');
    if (b) show('advisory', b.dataset.advisory);
  });
  $('#aback').onclick = () => show('updates');
  $('#adet').addEventListener('click', (e) => {
    const t = e.target.closest('[data-photo]');
    if (t && current) {
      const i = +t.dataset.photo, img = $('#agimg');
      img.src = photoUrl(current.photo_paths[i]);
      img.alt = `${current.title}, photo ${i + 1} of ${current.photo_paths.length}`;
      $('#adet').querySelectorAll('[data-photo]').forEach((x) => x.setAttribute('aria-pressed', x === t));
    }
    if (e.target.closest('#arep') && current) prefill(current.location || current.title);
    if (e.target.closest('#amap')) show('map');
  });
  onShow('advisory', (id) => { if (id) open(id); });
}
