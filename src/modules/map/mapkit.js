// Shared by the map page and the staff map editor: the OpenStreetMap base map (drawn with the Leaflet
// library), the LRT line, and how each kind of map feature looks.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { STATIONS, LINE_PATHS } from './line.js';

// The kinds of feature staff can put on the map: [kind in the database, legend label, letter on the marker].
export const KINDS = [
  ['closure', 'Road closures', '×'],
  ['walk', 'Pedestrian routes', 'P'],
  ['detour', 'Detour routes', 'D'],
  ['biz', 'Business access', 'B'],
];
export const KIND_NAME = { closure: 'Road closure', walk: 'Pedestrian route', detour: 'Detour route', biz: 'Business access' };
const LETTER = { ...Object.fromEntries(KINDS.map(([kind, , letter]) => [kind, letter])), spot: '!' };

// Line styles for routes. The map tiles are always light, so these colours stay the same in dark mode.
const ROUTE = {
  closure: { color: '#B3261E', weight: 7 },
  walk: { color: '#8A4B00', weight: 5, dashArray: '8 8' },
  detour: { color: '#1D5FA8', weight: 5, dashArray: '1 9', lineCap: 'round' },
};
export const hasRoute = (kind) => kind in ROUTE;

// OpenStreetMap asks every site that shows its tiles to credit it. Leaflet shows this in the map corner.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PENANG = [[5.17, 100.14], [5.53, 100.5]]; // the map cannot be dragged far outside this box
const LINE_BOUNDS = STATIONS.map((s) => [s.lat, s.lng]);

// Shows the whole line.
export const resetView = (map) => map.fitBounds(LINE_BOUNDS, { padding: [24, 24] });

// Draws the base map inside the element `el` and returns the Leaflet map. Call map.remove() when the page closes.
export function createMap(el) {
  const map = L.map(el, { minZoom: 11, maxBounds: PENANG, maxBoundsViscosity: 0.8 });
  L.tileLayer(TILES, { maxZoom: 19, attribution: CREDIT }).addTo(map);
  resetView(map);
  return map;
}

// One marker. `item` needs name, lat and lng (and status, for screen readers).
// With onPick the marker can be selected by mouse, touch or keyboard (Tab, then Enter or Space).
export function pin(kind, item, onPick, options = {}) {
  const size = kind === 'station' ? 18 : 32;
  const marker = L.marker([item.lat, item.lng], {
    icon: L.divIcon({ className: `mpin mpin-${kind}`, html: LETTER[kind] || '', iconSize: [size, size] }),
    interactive: !!onPick, keyboard: !!onPick, ...options,
  });
  if (item.name) marker.bindTooltip(item.name, { direction: 'top', offset: [0, -size / 2] });
  if (onPick) {
    marker.on('click', onPick);
    marker.on('add', () => {
      const el = marker.getElement();
      el.setAttribute('aria-label', item.status ? `${item.name}, ${item.status}` : item.name);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); }
      });
    });
  }
  return marker;
}

// A route line for a closure, pedestrian route or detour. `path` is a list of [latitude, longitude] points.
export function route(kind, path, onPick) {
  const line = L.polyline(path, { ...ROUTE[kind], interactive: !!onPick, bubblingMouseEvents: false });
  if (onPick) line.on('click', onPick);
  return line;
}

// One row of the map_features table: its marker, plus its route when it has one.
export function drawFeature(f, onPick) {
  const marker = pin(f.kind, f, onPick);
  const layers = [marker];
  if (hasRoute(f.kind) && Array.isArray(f.path) && f.path.length > 1) layers.unshift(route(f.kind, f.path, onPick));
  return { marker, layers };
}

// The LRT line with its stations. Returns the layer and each station's marker by name.
export function lineLayer(onPick) {
  const layer = L.layerGroup();
  const pins = new Map();
  // A white edge under the green line keeps it readable on top of busy streets.
  LINE_PATHS.forEach((p) => L.polyline(p, { color: '#fff', weight: 9, interactive: false }).addTo(layer));
  LINE_PATHS.forEach((p) => L.polyline(p, { color: '#0C3B2E', weight: 5, interactive: false }).addTo(layer));
  STATIONS.forEach((s) => {
    const item = { ...s, status: 'Station' };
    pins.set(s.name, pin('station', item, onPick && (() => onPick(s))).addTo(layer));
  });
  return { layer, pins };
}
