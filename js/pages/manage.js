// My advisories (UC06 to UC08): staff post new advisories, edit drafts and published ones,
// publish drafts and end advisories when the work finishes.
import { listMyAdvisories, saveAdvisory, publishAdvisory, endAdvisory, uploadAdvisoryPhoto, photoUrl, myProfile } from '../api.js';
import { $, $$, esc, opts, CATS, dateRange, ago, todayISO } from '../util.js';
import { show, onShow } from '../router.js';

const MAX_PHOTOS = 5;
// Form field for each database column.
const F = {
  title: '#mt', category: '#mc', zone_id: '#mz', location: '#ml', starts_on: '#ms1', ends_on: '#me1', work_hours: '#mh',
  severity: '#mv', status: '#mst', body: '#mb', detour: '#md', affected_businesses: '#mbz',
};

let all = [], tab = 'Published', editing = null;
let kept = [];  // photo paths already saved with the advisory
let added = []; // new File objects waiting to be uploaded

const note = (sel, text) => { $(sel).textContent = text || ''; $(sel).hidden = !text; };

// ---------- List and tabs (UC07) ----------
async function load() {
  note('#merr', '');
  try { all = await listMyAdvisories(); } catch (e) {
    console.error(e); all = [];
    note('#merr', 'Could not load advisories. Please try again later.');
  }
  renderList();
}

function actions(a) {
  const b = (act, label, cls = 's') =>
    `<button type="button" class="btn ${cls} sm" data-act="${act}" data-id="${a.id}" aria-label="${label}: ${esc(a.title)}">${label}</button>`;
  if (a.state === 'Draft') return b('edit', 'Edit') + b('publish', 'Publish', '');
  if (a.state === 'Published') return b('view', 'View') + b('edit', 'Edit') + b('end', 'End', 'warn');
  return b('view', 'View');
}

function renderList() {
  $$('#mtabs [data-state]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.state === tab);
    b.querySelector('span').textContent = all.filter((a) => a.state === b.dataset.state).length;
  });
  const rows = all.filter((a) => a.state === tab);
  $('#mtb').innerHTML = rows.map((a) => `<tr>
    <td><b>${esc(a.title)}</b>${a.severity === 'High' ? ' <span class="pill hot">Urgent</span>' : ''}<br><span class="mut">${esc(a.status)}${a.location ? ` · ${esc(a.location)}` : ''}</span></td>
    <td>${esc(a.category)}</td><td>${esc(a.zones ? a.zones.name : 'All areas')}</td>
    <td>${esc(dateRange(a.starts_on, a.ends_on))}</td><td>${esc(ago(a.updated_at))}</td>
    <td class="acts">${actions(a)}</td></tr>`).join('');
  $('#mempty').hidden = rows.length > 0;
}

// ---------- Form (UC06 and editing) ----------
function renderThumbs() {
  const items = [
    ...kept.map((p, i) => ({ src: photoUrl(p), id: `kept:${i}` })),
    ...added.map((f, i) => ({ src: f.preview, id: `added:${i}` })),
  ];
  $('#mthumbs').innerHTML = items.map((t, n) => `<figure class="thumb"><img src="${esc(t.src)}" alt="Photo ${n + 1}">` +
    `<button type="button" data-rm="${t.id}" aria-label="Remove photo ${n + 1}">×</button></figure>`).join('');
  $('#mp').disabled = items.length >= MAX_PHOTOS;
}

function openForm(a) {
  editing = a || null;
  added.forEach((f) => URL.revokeObjectURL(f.preview));
  kept = a ? [...(a.photo_paths || [])] : [];
  added = [];
  $('#mform').reset();
  Object.entries(F).forEach(([k, sel]) => { if (a) $(sel).value = a[k] == null ? '' : a[k]; });
  if (!a) $('#ms1').value = todayISO();
  const published = !!a && a.state === 'Published';
  $('#mftitle').textContent = a ? `Edit: ${a.title}` : 'New advisory';
  $('#mdraft').hidden = published; // a published advisory is not moved back to draft
  $('#mpub').textContent = published ? 'Save changes' : 'Publish';
  ['#mte', '#mse', '#mde', '#mpe', '#mfe'].forEach((s) => note(s, ''));
  renderThumbs();
  note('#mok', '');
  $('#mform').hidden = false;
  $('#mform').scrollIntoView({ block: 'start' });
  $('#mt').focus({ preventScroll: true });
}

function closeForm() {
  added.forEach((f) => URL.revokeObjectURL(f.preview));
  added = []; kept = []; editing = null;
  $('#mform').hidden = true;
}

function addPhotos() {
  const problems = new Set();
  [...$('#mp').files].forEach((f) => {
    if (!['image/jpeg', 'image/png'].includes(f.type) || f.size > 5 * 1024 * 1024) problems.add(`${f.name} is not a JPG or PNG up to 5 MB.`);
    else if (kept.length + added.length >= MAX_PHOTOS) problems.add(`You can add at most ${MAX_PHOTOS} photos.`);
    else { f.preview = URL.createObjectURL(f); added.push(f); }
  });
  $('#mp').value = '';
  note('#mpe', [...problems].join(' '));
  renderThumbs();
}

// Returns the first field with a problem, or null when the form is fine.
function validate() {
  const title = $('#mt').value.trim(), start = $('#ms1').value, end = $('#me1').value;
  const bad = [];
  note('#mte', title.length >= 3 && title.length <= 150 ? '' : 'Enter a title of 3 to 150 characters.'); if (!$('#mte').hidden) bad.push('#mt');
  note('#mse', start ? '' : 'Choose the start date.'); if (!$('#mse').hidden) bad.push('#ms1');
  note('#mde', start && end && end < start ? 'The end date must be on or after the start date.' : ''); if (!$('#mde').hidden) bad.push('#me1');
  return bad[0] || null;
}

async function submit(e) {
  e.preventDefault();
  // Pressing Enter uses the first submit button. Save as draft comes first so Enter never publishes by accident;
  // when it is hidden (editing a published advisory) the advisory simply stays published.
  const state = e.submitter && e.submitter.value === 'Draft' && !$('#mdraft').hidden ? 'Draft' : 'Published';
  const badField = validate();
  if (badField) { $(badField).focus(); return; }
  note('#mfe', '');
  const buttons = $$('#mform .mactions button');
  buttons.forEach((b) => { b.disabled = true; });
  const label = e.submitter ? e.submitter.textContent : '';
  if (e.submitter) e.submitter.textContent = 'Saving…';
  try {
    // Upload new photos one by one. Each uploaded photo moves to "kept", so a retry does not upload it twice.
    while (added.length) {
      const f = added[0];
      kept.push(await uploadAdvisoryPhoto(f));
      URL.revokeObjectURL(f.preview);
      added.shift();
    }
    const text = (sel) => $(sel).value.trim() || null;
    const fields = {
      title: $('#mt').value.trim(), category: $('#mc').value, zone_id: $('#mz').value ? +$('#mz').value : null,
      location: text('#ml'), starts_on: $('#ms1').value, ends_on: $('#me1').value || null, work_hours: text('#mh'),
      severity: $('#mv').value, status: $('#mst').value, body: $('#mb').value.trim(), detour: text('#md'),
      affected_businesses: text('#mbz'), photo_paths: kept, state,
    };
    const wasNew = !editing;
    const saved = await saveAdvisory(editing && editing.id, fields);
    closeForm();
    tab = saved.state;
    await load();
    note('#mok', state === 'Draft' ? `Draft saved: ${saved.title}` : wasNew ? `Published: ${saved.title}` : `Saved: ${saved.title}`);
  } catch (err) {
    console.error(err);
    renderThumbs();
    note('#mfe', `Could not save the advisory. ${err.message}`);
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
    if (e.submitter) e.submitter.textContent = label;
  }
}

// ---------- Row buttons: view, edit, publish, end (UC08) ----------
async function rowAction(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = all.find((x) => String(x.id) === b.dataset.id);
  if (!a) return;
  const act = b.dataset.act;
  if (act === 'view') { show('advisory', a.id); return; }
  if (act === 'edit') { openForm(a); return; }
  if (act === 'end' && !confirm(`End "${a.title}"?\n\nUse this when the work has finished. The advisory moves to the ended archive and shows as completed.`)) return;
  b.disabled = true;
  note('#mok', ''); note('#merr', '');
  try {
    if (act === 'publish') { await publishAdvisory(a.id); tab = 'Published'; } else { await endAdvisory(a.id); tab = 'Ended'; }
    await load();
    note('#mok', `${act === 'publish' ? 'Published' : 'Ended'}: ${a.title}`);
  } catch (err) {
    console.error(err);
    b.disabled = false;
    note('#merr', `Could not ${act} the advisory. ${err.message}`);
  }
}

export function init() {
  $('#mc').innerHTML = opts(CATS);
  $('#mnew').onclick = () => openForm();
  $('#mcancel').onclick = closeForm;
  $('#mp').onchange = addPhotos;
  $('#mthumbs').onclick = (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const [list, i] = b.dataset.rm.split(':');
    if (list === 'kept') kept.splice(+i, 1);
    else URL.revokeObjectURL(added.splice(+i, 1)[0].preview);
    renderThumbs();
  };
  $('#mform').onsubmit = submit;
  $('#mtabs').onclick = (e) => {
    const b = e.target.closest('[data-state]');
    if (b) { tab = b.dataset.state; note('#mok', ''); renderList(); }
  };
  $('#mtb').onclick = rowAction;
  onShow('manage', async () => {
    load();
    let profile = null;
    try { profile = await myProfile(); } catch (e) { console.error(e); }
    $('#mdemo').hidden = !!profile;
  });
}
