// Map editor (UC17, staff only): add, move, change and delete the closures, routes and business access
// points that the public map shows. Click the map to place the marker, or switch to "Draw route" and click
// along the road to draw the closed section, detour or walking route.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import L from 'leaflet';
import PageHero from '../../shared/PageHero.jsx';
import { dateRange } from '../../shared/util.js';
import { listMapFeatures, saveMapFeature, deleteMapFeature, listAdvisoryTitles } from './api.js';
import { KINDS, KIND_NAME, hasRoute, createMap, lineLayer, drawFeature, pin, route } from './mapkit.js';

const STATUSES = ['Closed', 'Partly closed', 'Open'];
// Form fields, named after their database columns. path is a list of [latitude, longitude] points.
const EMPTY = { id: null, kind: 'closure', name: '', status: 'Closed', detail: '', starts_on: '', ends_on: '', update_id: '', lat: null, lng: null, path: [] };
const round = (n) => Math.round(n * 1e6) / 1e6; // six decimal places is about 10 cm

export default function MapEditPage() {
  const box = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);  // Leaflet layers: saved (features already in the database) and draft (the one being edited)
  const [features, setFeatures] = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [v, setV] = useState(null);         // the form, or null when it is closed
  const [mode, setMode] = useState('point'); // what a click on the map does: 'point' moves the marker, 'line' adds a route point
  const [saving, setSaving] = useState(false);
  const [sure, setSure] = useState(false);   // Delete was pressed once and waits for a second press
  const [formErr, setFormErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [listErr, setListErr] = useState('');
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const load = async () => {
    setListErr('');
    try { setFeatures(await listMapFeatures()); } catch (e) {
      console.error(e);
      setListErr('Could not load the map features. Please try again later.');
    }
  };

  useEffect(() => {
    const m = createMap(box.current);
    lineLayer().layer.addTo(m);
    map.current = m;
    layers.current = { saved: L.layerGroup().addTo(m), draft: L.layerGroup().addTo(m) };
    // A click moves the marker or adds a route point, depending on the mode. Nothing happens while the form is closed.
    m.on('click', ({ latlng }) => {
      const p = [round(latlng.lat), round(latlng.lng)];
      setV((old) => {
        if (!old) return old;
        return modeRef.current === 'line' && hasRoute(old.kind) ? { ...old, path: [...old.path, p] } : { ...old, lat: p[0], lng: p[1] };
      });
    });
    load();
    listAdvisoryTitles().then(setAdvisories, (e) => console.error(e));
    return () => { m.remove(); map.current = null; layers.current = null; };
  }, []);

  const openForm = (f) => {
    setV(f ? {
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, f[k] == null ? '' : f[k]])),
      id: f.id, lat: f.lat, lng: f.lng, path: Array.isArray(f.path) ? f.path : [],
    } : EMPTY);
    setMode('point'); setSure(false); setFormErr(''); setOkMsg('');
    if (f) map.current.setView([f.lat, f.lng], Math.max(map.current.getZoom(), 16));
  };

  // Saved features, except the one being edited. Selecting one opens it in the form.
  const editingId = v && v.id;
  useEffect(() => {
    const { saved } = layers.current;
    saved.clearLayers();
    features.filter((f) => f.id !== editingId).forEach((f) => drawFeature(f, () => openForm(f)).layers.forEach((l) => saved.addLayer(l)));
  }, [features, editingId]);

  // The feature being edited: a marker that can be dragged, and its route with a dot at each point.
  useEffect(() => {
    const { draft } = layers.current;
    draft.clearLayers();
    if (!v) return;
    if (hasRoute(v.kind) && v.path.length) {
      if (v.path.length > 1) route(v.kind, v.path).addTo(draft);
      v.path.forEach((p) => L.circleMarker(p, { radius: 5, color: '#13261F', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(draft));
    }
    if (v.lat != null) {
      const marker = pin(v.kind, { lat: v.lat, lng: v.lng }, null, { draggable: true, interactive: true }).addTo(draft);
      marker.on('dragend', () => {
        const at = marker.getLatLng();
        setV((old) => old && { ...old, lat: round(at.lat), lng: round(at.lng) });
      });
    }
  }, [v && v.kind, v && v.lat, v && v.lng, v && v.path]);

  // A problem such as "place the marker" goes away as soon as the marker or route changes.
  useEffect(() => { setFormErr(''); }, [v && v.lat, v && v.lng, v && v.path]);

  const field = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) });

  const submit = async (e) => {
    e.preventDefault();
    const name = v.name.trim();
    const path = hasRoute(v.kind) ? v.path : [];
    let problem = '';
    if (name.length < 2) problem = 'Enter a name of at least 2 characters.';
    else if (v.lat == null && !path.length) problem = 'Click the map to place the marker.';
    else if (path.length === 1) problem = 'A route needs at least two points. Add another point or clear the route.';
    else if (v.starts_on && v.ends_on && v.ends_on < v.starts_on) problem = 'The end date must be on or after the start date.';
    setFormErr(problem);
    if (problem) return;
    // With a route but no marker, the marker goes on the middle point of the route.
    const [lat, lng] = v.lat != null ? [v.lat, v.lng] : path[Math.floor(path.length / 2)];
    setSaving(true);
    try {
      await saveMapFeature(v.id, {
        kind: v.kind, name, status: v.status, detail: v.detail.trim(), lat, lng, path: path.length ? path : null,
        starts_on: v.starts_on || null, ends_on: v.ends_on || null, update_id: v.update_id ? +v.update_id : null,
      });
      setV(null);
      setOkMsg(`Saved "${name}". It now shows on the public map.`);
      await load();
    } catch (err) {
      console.error(err);
      setFormErr('Could not save. Check that you are signed in as staff, then try again.');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!sure) { setSure(true); return; }
    setSaving(true);
    try {
      await deleteMapFeature(v.id);
      setOkMsg(`Deleted "${v.name}".`);
      setV(null);
      await load();
    } catch (err) {
      console.error(err);
      setFormErr('Could not delete. Check that you are signed in as staff, then try again.');
    } finally { setSaving(false); setSure(false); }
  };

  return (
    <section>
      <PageHero kicker="Staff" photo="advisory-barriers.jpg" title="Edit the map"
        sub="Place closures, detours, pedestrian routes and business access points on the public map.">
        <div className="ctas" style={{ justifyContent: 'flex-start' }}><Link className="btn gh" to="/map">View the public map</Link></div>
      </PageHero>
      <div className="mgrid edit">
        {v ? (
          <form className="card stack" noValidate aria-labelledby="eftitle" onSubmit={submit}>
            <h2 id="eftitle">{v.id ? `Edit: ${v.name}` : 'New map feature'}</h2>
            <div><label htmlFor="ek">Type</label>
              <select id="ek" className="in" {...field('kind')}>{KINDS.map(([kind]) => <option key={kind} value={kind}>{KIND_NAME[kind]}</option>)}</select></div>
            <div><label htmlFor="en">Name</label><input id="en" className="in" maxLength={100} placeholder="e.g. Sample Road B" {...field('name')} /></div>
            <div><label htmlFor="es">Status</label>
              <select id="es" className="in" {...field('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label htmlFor="ed">Details</label><textarea id="ed" className="in" rows={3} placeholder="What should people know or do here?" {...field('detail')} /></div>
            <div className="fgrid2">
              <div><label htmlFor="ef">Start date</label><input id="ef" className="in" type="date" {...field('starts_on')} /></div>
              <div><label htmlFor="et">End date</label><input id="et" className="in" type="date" {...field('ends_on')} /></div>
            </div>
            <div><label htmlFor="ea">Linked advisory (optional)</label>
              <select id="ea" className="in" {...field('update_id')}>
                <option value="">None</option>
                {advisories.map((a) => <option key={a.id} value={a.id}>{a.title}{a.state === 'Draft' ? ' (draft)' : ''}</option>)}
              </select></div>
            <div>
              <label id="emode">A click on the map</label>
              <div className="tabs" role="group" aria-labelledby="emode" style={{ margin: 0 }}>
                <button type="button" aria-pressed={mode === 'point'} onClick={() => setMode('point')}>Places the marker</button>
                <button type="button" aria-pressed={mode === 'line'} disabled={!hasRoute(v.kind)} onClick={() => setMode('line')}>Draws the route</button>
              </div>
              <p className="mut hint" role="status">
                {v.lat == null ? 'No marker yet.' : `Marker at ${v.lat}, ${v.lng}. Drag it to move it.`}
                {hasRoute(v.kind) && ` Route: ${v.path.length} point${v.path.length === 1 ? '' : 's'}.`}
              </p>
              {hasRoute(v.kind) && (
                <div className="mtools">
                  <button type="button" className="btn s sm" disabled={!v.path.length} onClick={() => setV({ ...v, path: v.path.slice(0, -1) })}>Undo last point</button>
                  <button type="button" className="btn s sm" disabled={!v.path.length} onClick={() => setV({ ...v, path: [] })}>Clear route</button>
                </div>
              )}
            </div>
            <div className="mactions">
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn s" type="button" disabled={saving} onClick={() => setV(null)}>Cancel</button>
              {v.id && <button className="btn warn" type="button" disabled={saving} onClick={remove}>{sure ? 'Yes, delete it' : 'Delete'}</button>}
            </div>
            {formErr && <p className="err" role="alert">{formErr}</p>}
          </form>
        ) : (
          <div className="card stack">
            <h2>Map features</h2>
            <button type="button" className="btn" style={{ width: '100%' }} onClick={() => openForm()}>+ New map feature</button>
            {okMsg && <p className="ok" role="status">{okMsg}</p>}
            {listErr && <p className="err" role="alert">{listErr}</p>}
            <ul className="mlist">
              {features.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => openForm(f)}>
                    <span className={`mpin mpin-${f.kind} msw`} aria-hidden="true">{KINDS.find(([kind]) => kind === f.kind)?.[2]}</span>
                    <span><b>{f.name}</b><small>{f.status} · {dateRange(f.starts_on, f.ends_on)}</small></span>
                  </button>
                </li>
              ))}
            </ul>
            {!features.length && !listErr && <p className="mut">No features yet. Add the first one.</p>}
          </div>
        )}
        <div className="card lmap-wrap">
          <div ref={box} className="lmap" role="region" aria-label="Map for placing features. Click to place the marker or draw the route." />
        </div>
      </div>
    </section>
  );
}
