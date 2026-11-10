// Module 2: disruption map. Database calls for the map live here, plus the OpenStreetMap place search.
import { sb, ok } from '../../shared/supabase.js';

// Each feature comes with the advisory it is linked to (Module 1), when that advisory is public.
const FEATURE = '*, advisory:updates(id, title, state, work_hours, detour, affected_businesses)';

// UC09: every closure, route and business access point. Stations are drawn from line.js instead,
// so old station rows in the table are left out.
export const listMapFeatures = async () =>
  ok(await sb.from('map_features').select(FEATURE).neq('kind', 'station').order('kind').order('name'));

// UC12: looks a place up in OpenStreetMap (its free Nominatim search), inside Penang only.
// Returns { name, address, lat, lng }, or null when nothing matches.
// Nominatim allows one search a second at most, so call this when the visitor presses Search, never on every key.
export async function findPlace(q) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q, format: 'jsonv2', limit: '1', countrycodes: 'my',
    viewbox: '100.14,5.53,100.50,5.17', bounded: '1', // west, north, east, south
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenStreetMap search failed (${res.status}).`);
  const [hit] = await res.json();
  if (!hit) return null;
  return { name: hit.name || hit.display_name.split(',')[0], address: hit.display_name, lat: +hit.lat, lng: +hit.lon };
}

// ---------- Staff only (UC17) ----------
// The database only lets signed-in staff change map features.

// Creates a feature when id is empty, otherwise saves the changed fields.
export async function saveMapFeature(id, fields) {
  const q = id ? sb.from('map_features').update(fields).eq('id', id) : sb.from('map_features').insert(fields);
  return ok(await q.select(FEATURE).single());
}

export const deleteMapFeature = async (id) => ok(await sb.from('map_features').delete().eq('id', id));

// Advisories a feature can be linked to: drafts and published ones, not ended ones.
export const listAdvisoryTitles = async () =>
  ok(await sb.from('updates').select('id, title, state').neq('state', 'Ended').order('title'));
