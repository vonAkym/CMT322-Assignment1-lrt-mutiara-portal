// The place of an advisory on the map. Uses the same OpenStreetMap base map and LRT line as the
// disruption map (Module 2, see ../map/mapkit.js).
//   LocationPicker: in the staff form (UC06, UC07). Search a street or click the map to drop the pin; drag it to adjust.
//   PlaceMap: on the advisory page (UC02). A small map with the pin, and a link to the full map.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createMap, lineLayer, pin } from '../map/mapkit.js';
import { findPlace } from '../map/api.js';

const round = (n) => Math.round(n * 1e6) / 1e6; // six decimal places is about 10 cm
const ZOOM = 16;

// Address of the full map, zoomed to this advisory's pin (the map page reads these).
export const mapUrl = (a) =>
  `/map?${new URLSearchParams({ at: `${a.lat},${a.lng}`, name: a.location || a.title, advisory: String(a.id) })}`;

// value is { lat, lng } or null. onChange gets the new { lat, lng }, or null when the pin is removed.
// onFound gets the name of a place found by the search, so the form can fill in the Location box.
export function LocationPicker({ value, onChange, onFound }) {
  const box = useRef(null);
  const map = useRef(null);
  const spot = useRef(null);
  const cb = useRef({ onChange, onFound });
  cb.current = { onChange, onFound };
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const m = createMap(box.current);
    lineLayer().layer.addTo(m);
    spot.current = L.layerGroup().addTo(m);
    m.on('click', ({ latlng }) => { setMsg(''); cb.current.onChange({ lat: round(latlng.lat), lng: round(latlng.lng) }); });
    if (value) m.setView([value.lat, value.lng], ZOOM); // editing: start at the saved pin
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  // The pin, which can be dragged to fine-tune it.
  useEffect(() => {
    spot.current.clearLayers();
    if (!value) return;
    const marker = pin('spot', { ...value, name: 'Works location' }, null, { draggable: true, interactive: true }).addTo(spot.current);
    marker.on('dragend', () => {
      const at = marker.getLatLng();
      cb.current.onChange({ lat: round(at.lat), lng: round(at.lng) });
    });
  }, [value && value.lat, value && value.lng]);

  // OpenStreetMap search, inside Penang. It runs on the button or Enter, never on every key (its usage rules).
  const search = async () => {
    const term = q.trim();
    if (!term) return;
    setMsg('Searching OpenStreetMap…');
    try {
      const place = await findPlace(term);
      if (!place) { setMsg(`No place called "${term}" was found in Penang. Click the map instead.`); return; }
      setMsg(`Pin placed at ${place.name}. Drag it or click the map to adjust.`);
      map.current.setView([place.lat, place.lng], 17);
      cb.current.onChange({ lat: round(place.lat), lng: round(place.lng) });
      if (cb.current.onFound) cb.current.onFound(place.name);
    } catch (e) {
      console.error(e);
      setMsg('Could not search OpenStreetMap. Click the map to place the pin instead.');
    }
  };

  return (
    <div className="stack pick">
      <div className="pick-find">
        <input id="mfind" className="in" type="search" aria-label="Search a street or place in Penang" placeholder="Find a place, e.g. Komtar"
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
        <button type="button" className="btn s" onClick={search}>Find</button>
      </div>
      <div className="lmap-wrap amap-wrap">
        <div ref={box} className="lmap amap" role="region" aria-label="Map for placing the works location. Click to place the pin." />
      </div>
      <p className="mut hint" role="status">
        {msg || (value ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drag it or click the map to move it.` : 'No pin yet. Click the map where the works are.')}
      </p>
      {value && <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setMsg(''); onChange(null); }}>Remove pin</button>}
    </div>
  );
}

// A small map with the advisory's pin. Read only apart from moving and zooming.
export function PlaceMap({ lat, lng, name }) {
  const box = useRef(null);
  useEffect(() => {
    const m = createMap(box.current);
    lineLayer().layer.addTo(m);
    pin('spot', { lat, lng, name }).addTo(m);
    m.setView([lat, lng], ZOOM);
    return () => m.remove();
  }, [lat, lng, name]);
  return (
    <div className="lmap-wrap amap-wrap">
      <div ref={box} className="lmap amap" role="region" aria-label={`Map showing where the works are: ${name}`} />
    </div>
  );
}
