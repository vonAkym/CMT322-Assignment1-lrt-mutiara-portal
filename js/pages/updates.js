// Advisories page (UC03): search and filter the published advisories, or browse the ended archive.
import { listAdvisories } from '../api.js';
import { $, opts, CATS } from '../util.js';
import { show, onShow } from '../router.js';
import { card } from './advisory.js';

const FIELDS = { q: '#fq', zoneId: '#fz', category: '#fc', status: '#fs', onDate: '#fd' };

// Each filter change asks the database again. seq makes sure only the newest answer is drawn.
let seq = 0, typing;
async function renderU() {
  const my = ++seq, status = $('#fs').value;
  const filters = {
    q: $('#fq').value, zoneId: $('#fz').value, category: $('#fc').value, onDate: $('#fd').value,
    status: status === 'ended' ? '' : status, ended: status === 'ended',
    severity: $('#fu').checked ? 'High' : '',
  };
  $('#uempty').hidden = true;
  let list;
  try { list = await listAdvisories(filters); } catch (e) {
    if (my !== seq) return;
    console.error(e);
    $('#ulist').innerHTML = ''; $('#ucount').textContent = '';
    $('#uempty').textContent = 'Could not load advisories. Please try again later.';
    $('#uempty').hidden = false;
    return;
  }
  if (my !== seq) return;
  $('#ulist').innerHTML = list.map(card).join('');
  $('#ucount').textContent = `${list.length} ${filters.ended ? 'ended ' : ''}advisor${list.length === 1 ? 'y' : 'ies'}`;
  $('#uempty').textContent = 'No advisories match these filters.';
  $('#uempty').hidden = list.length > 0;
}

// Used by the home page and the urgent banner: set some filters (the rest are cleared) and open this page.
export function applyFilters(f = {}) {
  Object.entries(FIELDS).forEach(([k, sel]) => { $(sel).value = f[k] || ''; });
  $('#fu').checked = !!f.urgent;
  show('updates');
}
export const search = (q, zoneId) => applyFilters({ q, zoneId });

export function init() {
  $('#fc').innerHTML = opts(CATS, 'All types');
  $('#fq').oninput = () => { clearTimeout(typing); typing = setTimeout(renderU, 300); };
  ['#fz', '#fc', '#fs', '#fd', '#fu'].forEach((s) => { $(s).onchange = renderU; });
  $('#fclr').onclick = () => applyFilters();
  onShow('updates', renderU); // fresh list every time the page opens, e.g. after staff publish an advisory
  $('#sub').onclick = () => {
    const o = $('#sz').selectedOptions[0];
    $('#subMsg').textContent = `Subscribed. You will get alerts for ${o ? o.text : 'this area'} (simulation only).`;
  };
}
