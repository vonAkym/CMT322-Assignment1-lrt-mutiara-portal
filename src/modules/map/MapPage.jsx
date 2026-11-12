// Map page (UC09 to UC16): the LRT Mutiara Line and its disruptions on a real map.
// The base map is OpenStreetMap, drawn with Leaflet (see mapkit.js). Closures, routes and business access
// come from the map_features table; stations come from line.js.
// Drag to move, use the buttons or mouse wheel to zoom, select a marker for its details, or click any spot to report it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import L from 'leaflet';
import PageHero from '../../shared/PageHero.jsx';
import { useStaff } from '../../shared/staff.jsx';
import { todayISO, addDays, daysBetween, day, dateRange } from '../../shared/util.js';
import { reportUrl } from '../complaints/ReportPage.jsx';
import { listMapFeatures, findPlace } from './api.js';
import { STATIONS } from './line.js';
import { KINDS, KIND_NAME, createMap, resetView, lineLayer, drawFeature, pin } from './mapkit.js';

const LAYERS = [['station', 'LRT line and stations', ''], ...KINDS];
const DAYS = 30; // how far ahead the date slider goes

// True when the feature is in force on that day ('YYYY-MM-DD'). No start or end date means open-ended.
const activeOn = (f, date) => (!f.starts_on || f.starts_on <= date) && (!f.ends_on || f.ends_on >= date);

const stationItem = (s) => ({
  ...s, kind: 'station', status: 'Station',
  detail: 'Planned station on the LRT Mutiara Line. The position shown is approximate.',
});

export default function MapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const staff = useStaff()?.staff;
  const box = useRef(null);        // the <div> Leaflet draws the map in
  const map = useRef(null);        // the Leaflet map
  const layers = useRef(null);     // Leaflet layers: line, stations (markers by name), features, spot
  const pins = useRef(new Map());  // feature id -> its marker
  const [features, setFeatures] = useState([]);
  const [loadErr, setLoadErr] = useState(false);
  const [on, setOn] = useState(() => new Set(LAYERS.map(([kind]) => kind)));
  const [offset, setOffset] = useState(0); // days from today (UC13)
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [picked, setPicked] = useState(null); // the feature, station or spot whose details show

  const today = todayISO();
  const date = addDays(today, offset);

  // Create the map once, and remove it when leaving the page.
  useEffect(() => {
    const m = createMap(box.current);
    const line = lineLayer((s) => setPicked(stationItem(s)));
    map.current = m;
    layers.current = { line: line.layer, stations: line.pins, features: L.layerGroup().addTo(m), spot: L.layerGroup().addTo(m) };
    // UC16: clicking an empty spot drops a pin there, ready to be reported.
    m.on('click', ({ latlng: { lat, lng } }) => setPicked({
      kind: 'spot', name: `Map pin ${lat.toFixed(5)}, ${lng.toFixed(5)}`, status: 'Selected spot', lat, lng,
      detail: 'A spot you selected on the map. Use the button below to report an issue at this location.',
    }));
    return () => { m.remove(); map.current = null; layers.current = null; };
  }, []);

  // Load the features. Ones that have already ended are left out.
  useEffect(() => {
    let live = true;
    listMapFeatures().then(
      (list) => { if (live) setFeatures(list.filter((f) => !f.ends_on || f.ends_on >= today)); },
      (e) => { console.error(e); if (live) setLoadErr(true); },
    );
    return () => { live = false; };
  }, []);

  // UC10 and UC13: the features to draw are those whose layer is ticked and that are in force on the chosen day.
  const visible = useMemo(() => features.filter((f) => on.has(f.kind) && activeOn(f, date)), [features, on, date]);

  useEffect(() => {
    const { features: group } = layers.current;
    group.clearLayers();
    pins.current.clear();
    visible.forEach((f) => {
      const drawn = drawFeature(f, () => setPicked(f));
      drawn.layers.forEach((layer) => group.addLayer(layer));
      pins.current.set(f.id, drawn.marker);
    });
  }, [visible]);

  useEffect(() => {
    const { line } = layers.current;
    if (on.has('station')) line.addTo(map.current); else line.remove();
  }, [on]);

  // Details only show for something still on the map (its layer may have been unticked, or the day changed).
  const sel = !picked ? null
    : picked.kind === 'spot' ? picked
    : picked.kind === 'station' ? (on.has('station') ? picked : null)
    : (visible.some((f) => f.id === picked.id) ? picked : null);

  // Highlight the selected marker, and show the pin for a selected spot.
  useEffect(() => {
    const { stations, spot } = layers.current;
    box.current.querySelectorAll('.mpin.sel').forEach((el) => el.classList.remove('sel'));
    spot.clearLayers();
    if (!sel) return;
    const marker = sel.kind === 'spot' ? pin('spot', sel).addTo(spot)
      : sel.kind === 'station' ? stations.get(sel.name) : pins.current.get(sel.id);
    marker?.getElement()?.classList.add('sel');
  }, [sel, visible]);

  const goTo = (item, zoom) => {
    setPicked(item);
    map.current.setView([item.lat, item.lng], Math.max(map.current.getZoom(), zoom));
  };

  // Opened from an advisory page (Module 1): /map?at=lat,lng&name=...&advisory=id zooms to the advisory's pin.
  useEffect(() => {
    const at = params.get('at');
    const [lat, lng] = at ? at.split(',').map(Number) : [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const id = params.get('advisory');
    goTo({
      kind: 'spot', name: params.get('name') || 'Works location', status: 'Advisory location', lat, lng,
      detail: 'Where the works in this advisory take place.', advisory: id ? { id } : null,
    }, 17);
    box.current.scrollIntoView({ block: 'center' }); // on a phone the map is below the controls
  }, [params]);

  // UC12: search our own markers and stations first, then real places in OpenStreetMap.
  const find = async (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const has = (x) => x.name.toLowerCase().includes(term.toLowerCase());
    setMsg('');
    const f = features.find(has);
    if (f) {
      // Move the slider when the feature only starts later, and tick its layer, so that it shows.
      if (!activeOn(f, date)) setOffset(Math.min(DAYS, Math.max(0, daysBetween(today, f.starts_on || today))));
      setOn(new Set([...on, f.kind]));
      goTo(f, 17);
      return;
    }
    const s = STATIONS.find(has);
    if (s) { setOn(new Set([...on, 'station'])); goTo(stationItem(s), 15); return; }
    setMsg('Searching OpenStreetMap…');
    try {
      const place = await findPlace(term);
      if (!place) { setMsg(`No place called "${term}" was found in Penang.`); return; }
      setMsg('');
      goTo({ kind: 'spot', name: place.name, status: 'Search result', detail: place.address, lat: place.lat, lng: place.lng }, 17);
    } catch (err) {
      console.error(err);
      setMsg('Could not search OpenStreetMap. Please try again later.');
    }
  };

  const toggle = (kind) => { const next = new Set(on); if (next.has(kind)) next.delete(kind); else next.add(kind); setOn(next); };
  const a = sel && sel.advisory;

  return (
    <section>
      <PageHero kicker="Disruption map" photo="advisory-barriers.jpg" title="Construction and disruption map"
        sub="Road closures, detours, pedestrian routes and business access along the LRT Mutiara Line. Station positions are approximate, and the disruptions are sample data.">
        {staff && <div className="ctas" style={{ justifyContent: 'flex-start' }}><Link className="btn gold" to="/map/edit">Edit the map</Link></div>}
      </PageHero>
      <div className="mgrid">
        <div className="card stack">
          <form onSubmit={find}>
            <label htmlFor="ms">Search station, street or business</label>
            <input id="ms" className="in" type="search" list="mlist" placeholder="e.g. Komtar" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            <datalist id="mlist">{[...features, ...STATIONS].map((x) => <option key={`${x.id || 's'}:${x.name}`} value={x.name} />)}</datalist>
            <button className="btn s" type="submit" style={{ width: '100%', marginTop: 8 }}>Search</button>
            <p className="mut hint" role="status">{msg}</p>
          </form>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Legend and layers</legend>
            {LAYERS.map(([kind, label, letter]) => (
              <label className="lg" key={kind}>
                <input type="checkbox" checked={on.has(kind)} onChange={() => toggle(kind)} />
                <span className={`mpin mpin-${kind} msw`} aria-hidden="true">{letter}</span>{label}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="day">Showing {day(date)}{offset === 0 ? ' (today)' : ''}</label>
            <input id="day" type="range" min="0" max={DAYS} value={offset} onChange={(e) => setOffset(+e.target.value)} style={{ width: '100%' }} />
            <p className="mut hint">Move the slider to see what is affected over the next {DAYS} days.</p>
          </div>
          <p className="mut mcount" role="status">{visible.length} disruption{visible.length === 1 ? '' : 's'} and access point{visible.length === 1 ? '' : 's'} shown</p>
          {loadErr && <p className="err" role="alert">Could not load the disruptions. The map itself still works. Please try again later.</p>}
        </div>

        <div className="card lmap-wrap">
          <button type="button" className="mreset" onClick={() => resetView(map.current)}>Reset view</button>
          <div ref={box} className="lmap" role="region" aria-label="Map of the LRT Mutiara Line with construction and disruption markers" />
        </div>

        <div className="card" aria-live="polite">
          {sel ? <>
            <span className={`pill ${sel.status === 'Open' || sel.status === 'Station' ? 'dn' : sel.kind === 'spot' ? '' : 'on'}`}>{sel.status}</span>
            <h3>{sel.name}</h3>
            {KIND_NAME[sel.kind] && <p className="mut">{KIND_NAME[sel.kind]} · {dateRange(sel.starts_on, sel.ends_on)}</p>}
            <p className="mut" style={{ marginTop: 6 }}>{sel.detail}</p>
            {a && <>
              <dl className="facts mfacts">
                {a.work_hours && <><dt>Work hours</dt><dd>{a.work_hours}</dd></>}
                {a.detour && <><dt>Detour</dt><dd>{a.detour}</dd></>}
                {a.affected_businesses && <><dt>Businesses</dt><dd>{a.affected_businesses}</dd></>}
              </dl>
              <Link className="back" to={`/advisories/${a.id}`} style={{ marginTop: 8 }}>Read the full advisory</Link>
            </>}
            <button type="button" className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => navigate(reportUrl(sel.name))}>Report an issue here</button>
          </> : <p className="mut">Select a station or marker on the map to see its details, or click any spot to report an issue there. Drag to move the map and use the buttons or mouse wheel to zoom.</p>}
        </div>
      </div>
    </section>
  );
}
