// Home page (UC01): today's numbers, the latest advisories, quick links and common questions.
import { hubSummary } from '../api.js';
import { $, $$ } from '../util.js';
import { show, onShow } from '../router.js';
import { applyFilters, search } from './updates.js';
import { card } from './advisory.js';

// What each number on the banner counts, as filters for the advisories page.
const TILES = {
  closures: { category: 'Road closure', status: 'Ongoing' },
  active: { status: 'Ongoing' },
  urgent: { urgent: true },
  thisWeek: {},
};

async function load() {
  try {
    const s = await hubSummary();
    Object.keys(TILES).forEach((k) => { $(`[data-tile="${k}"] b`).textContent = s[k]; });
    $('#hlatest').innerHTML = s.latest.length ? s.latest.map(card).join('') : '<p class="mut">There are no advisories at the moment.</p>';
  } catch (e) {
    console.error(e);
    $('#hlatest').innerHTML = '<p class="mut">Could not load the latest advisories. Please try again later.</p>';
  }
}

export function init() {
  $$('.hc').forEach((b) => { b.onclick = () => show(b.dataset.go); });
  $$('[data-tile]').forEach((b) => { b.onclick = () => { applyFilters(TILES[b.dataset.tile]); show('updates'); }; });
  $('#hall').onclick = () => { applyFilters(); show('updates'); };
  $('#hs').onsubmit = (e) => { e.preventDefault(); search($('#hq').value, $('#hz').value); show('updates'); };
  onShow('home', load); // fresh numbers every time the home page opens
}
