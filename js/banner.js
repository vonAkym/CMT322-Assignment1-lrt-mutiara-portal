// Urgent alert banner (UC05): shows high-severity advisories at the top of every page.
// Hiding it lasts for this browser tab, until the urgent advisories change.
import { listUrgent } from './api.js';
import { $, esc, dateRange } from './util.js';
import { show } from './router.js';
import { applyFilters } from './pages/updates.js';

export async function loadUrgentBanner() {
  let list;
  try { list = await listUrgent(); } catch (e) { console.error(e); return; }
  if (!list.length) return;
  const key = list.map((a) => `${a.id}:${a.updated_at}`).join(',');
  try { if (sessionStorage.getItem('urgentHidden') === key) return; } catch (e) { /* storage blocked: always show */ }

  const a = list[0], more = list.length - 1;
  $('#ubarText').innerHTML = `<b>Urgent:</b> ${esc(a.title)} (${esc(dateRange(a.starts_on, a.ends_on))}). ` +
    `<button type="button" class="ubar-link" data-advisory="${a.id}">See details</button>` +
    (more ? ` or <button type="button" class="ubar-link" id="ubarAll">view ${more} more urgent alert${more > 1 ? 's' : ''}</button>` : '');
  $('#ubar').hidden = false;

  if (more) $('#ubarAll').onclick = () => { applyFilters({ urgent: true }); show('updates'); };
  $('#ubarX').onclick = () => {
    $('#ubar').hidden = true;
    try { sessionStorage.setItem('urgentHidden', key); } catch (e) { /* private mode: just hide */ }
  };
}
