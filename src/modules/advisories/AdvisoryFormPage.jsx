// New advisory (UC06) and Edit advisory (UC07), staff only: #/manage/new and #/manage/12/edit.
// Saving goes back to Manage advisories, which shows what was saved. Leaving with unsaved changes asks first.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ZoneSelect from '../../shared/ZoneSelect.jsx';
import { isPhotoOk } from '../../shared/supabase.js';
import { CATS, SEVERITY, todayISO } from '../../shared/util.js';
import { useStaff } from '../../shared/staff.jsx';
import Icon from '../../shared/Icon.jsx';
import { getAdvisory, saveAdvisory, uploadAdvisoryPhoto, photoUrl, URGENT_LEAD_DAYS } from './api.js';
import PageHero from '../../shared/PageHero.jsx';
import { LocationPicker } from './AdvisoryMap.jsx';
import WorkHoursField, { NO_HOURS, hoursOf, hoursUsed, hoursProblem, hoursFieldId } from './WorkHoursField.jsx';
import { formatHours, parseHours } from './workHours.js';
import usePageTitle from '../../shared/usePageTitle.js';

const MAX_PHOTOS = 5;
const LEAVE = 'You have unsaved changes to this advisory. Leave without saving?';
const LIST = '/manage';
// Form fields, named after their database columns. lat and lng are the pin on the map ('' when there is none).
// The work hours are picked in wh_from, wh_to, wh_days and wh_all (see WorkHoursField.jsx) and saved as work_hours.
const EMPTY = {
  title: '', category: CATS[0], zone_id: '', location: '', lat: '', lng: '', starts_on: '', ends_on: '', work_hours: '',
  ...NO_HOURS, severity: 'Low', status: 'Planned', body: '', detour: '', affected_businesses: '',
};

// The form values for a saved advisory. Work hours in the site's own format fill the pickers; older text stays in
// work_hours, where the form shows it until staff replace it.
function formValues(a) {
  const values = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, a[k] == null ? '' : String(a[k])]));
  const h = parseHours(a.work_hours);
  if (!h) return values;
  return { ...values, work_hours: '', wh_from: h.from, wh_to: h.to, wh_days: h.days.join(','), wh_all: h.allDay ? '1' : '' };
}

// Returns the problems in the form, e.g. { title: '...' }. Empty when the form is fine.
function validate(v) {
  const e = {}, title = v.title.trim();
  if (title.length < 3 || title.length > 150) e.title = 'Enter a title of 3 to 150 characters.';
  if (!v.starts_on) e.starts_on = 'Choose the start date.';
  if (v.starts_on && v.ends_on && v.ends_on < v.starts_on) e.ends_on = 'The end date must be on or after the start date.';
  const hours = hoursProblem(v);
  if (hours) e.work_hours = hours;
  return e;
}
const FIELD_ID = { title: 'mt', starts_on: 'ms1', ends_on: 'me1' };
const snapshot = (values, photos) => JSON.stringify([values, photos]);

// A fresh form for every address, so going from one advisory to another never keeps the old values.
export default function AdvisoryFormPage() {
  const { id } = useParams();
  return <AdvisoryForm key={id || 'new'} id={id} />;
}

function AdvisoryForm({ id }) {
  const navigate = useNavigate();
  const { user, profile } = useStaff();
  const isAdmin = !!profile && profile.role === 'admin';
  const uid = user ? user.id : null;

  // For an edit: the advisory as saved. undefined while loading, null when it cannot be opened.
  const [editing, setEditing] = useState(id ? undefined : null);
  const [blocked, setBlocked] = useState(''); // why an advisory cannot be edited here
  const [v, setV] = useState({ ...EMPTY, starts_on: todayISO() });
  const [kept, setKept] = useState([]);   // photo paths already saved with the advisory
  const [added, setAdded] = useState([]); // new photos waiting to be uploaded: { file, preview }
  const [start, setStart] = useState(() => snapshot({ ...EMPTY, starts_on: todayISO() }, []));
  const [errs, setErrs] = useState({});
  const [photoErr, setPhotoErr] = useState('');
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(''); // the button being saved with ('Draft' or 'Published')
  const addedRef = useRef(added);
  addedRef.current = added;
  const ready = !id || !!editing;
  usePageTitle(id ? (editing ? `Edit: ${editing.title}` : 'Edit advisory') : 'New advisory');

  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    getAdvisory(id).then((a) => {
      if (!live) return;
      // Only the person who posted an advisory, or an admin, may change it (the database checks this too).
      if (!a) setBlocked('This advisory does not exist, or the connection failed.');
      else if (a.state === 'Ended') setBlocked('This advisory has ended, so it can no longer be changed.');
      else if (!isAdmin && (!uid || a.created_by !== uid)) setBlocked('Only the person who posted this advisory, or an admin, can change it.');
      else {
        const values = formValues(a), photos = [...(a.photo_paths || [])];
        setV(values); setKept(photos); setStart(snapshot(values, photos));
        setEditing(a);
        return;
      }
      setEditing(null);
    }, (e) => { console.error(e); if (live) { setBlocked('Could not load this advisory. Please try again later.'); setEditing(null); } });
    return () => { live = false; };
  }, [id, isAdmin, uid]);

  useEffect(() => () => addedRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []); // free photo previews on leaving
  // The cursor starts in the title once the form is there.
  useEffect(() => { if (ready && !blocked) document.getElementById('mt').focus(); }, [ready, blocked]);

  // ---------- Unsaved changes ----------
  // The form has unsaved changes when the fields or kept photos differ from what it opened with, or new photos
  // were added. Then Cancel, the back link, a link in the menu, or closing or reloading the tab asks first.
  const dirty = ready && !blocked && (added.length > 0 || snapshot(v, kept) !== start);
  const okToLeave = () => !dirty || window.confirm(LEAVE);

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ''; }; // the browser shows its own "Leave site?"
    // Menu and other links: asked here, before the router moves on. A plain left click only (not a new tab).
    const onLink = (e) => {
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link || link.target === '_blank' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (!window.confirm(LEAVE)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onLink, true);
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('click', onLink, true); };
  }, [dirty]);

  // Every change re-checks the fields that already show an error, so an error goes away as soon as it is fixed
  // (changing the start date can also fix the end date). Other fields are only checked on Save or Publish.
  const change = (next) => {
    setV(next);
    setErrs((old) => {
      const now = validate(next);
      return Object.fromEntries(Object.keys(old).filter((k) => now[k]).map((k) => [k, now[k]]));
    });
  };
  const field = (k) => ({ value: v[k], onChange: (e) => change({ ...v, [k]: e.target.value }) });
  const pinned = v.lat !== '' && v.lng !== '' ? { lat: +v.lat, lng: +v.lng } : null;
  const setPin = (p) => setV((x) => ({ ...x, lat: p ? String(p.lat) : '', lng: p ? String(p.lng) : '' }));
  // A place found by the map search fills in the Location box, unless staff already wrote something there.
  const foundPlace = (name) => setV((x) => (x.location.trim() ? x : { ...x, location: name }));

  const addPhotos = (e) => {
    const problems = new Set(), next = [...added];
    [...e.target.files].forEach((file) => {
      if (!isPhotoOk(file)) problems.add(`${file.name} is not a JPG or PNG up to 5 MB.`);
      else if (kept.length + next.length >= MAX_PHOTOS) problems.add(`You can add at most ${MAX_PHOTOS} photos.`);
      else next.push({ file, preview: URL.createObjectURL(file) });
    });
    e.target.value = '';
    setPhotoErr([...problems].join(' '));
    setAdded(next);
  };
  const removePhoto = (list, i) => {
    if (list === 'kept') setKept(kept.filter((_, n) => n !== i));
    else { URL.revokeObjectURL(added[i].preview); setAdded(added.filter((_, n) => n !== i)); }
  };

  const published = !!editing && editing.state === 'Published';
  const cancel = () => { if (okToLeave()) navigate(LIST); };

  const submit = async (e) => {
    e.preventDefault();
    // Pressing Enter uses the first submit button. Save as draft comes first so Enter never publishes by accident;
    // when it is hidden (editing a published advisory) the advisory simply stays published.
    const submitter = e.nativeEvent.submitter;
    const state = submitter && submitter.value === 'Draft' && !published ? 'Draft' : 'Published';
    const problems = validate(v);
    setErrs(problems);
    const bad = ['title', 'starts_on', 'ends_on', 'work_hours'].find((k) => problems[k]);
    if (bad) { document.getElementById(bad === 'work_hours' ? hoursFieldId(v) : FIELD_ID[bad]).focus(); return; }
    setFormErr('');
    setSaving(submitter ? submitter.value : 'Published');
    // Upload new photos one by one. Each uploaded photo moves to "kept", so a retry does not upload it twice.
    const k = [...kept], waiting = [...added];
    try {
      while (waiting.length) {
        k.push(await uploadAdvisoryPhoto(waiting[0].file));
        URL.revokeObjectURL(waiting[0].preview);
        waiting.shift();
      }
      const text = (s) => s.trim() || null;
      const fields = {
        title: v.title.trim(), category: v.category, zone_id: v.zone_id ? +v.zone_id : null,
        location: text(v.location), starts_on: v.starts_on, ends_on: v.ends_on || null,
        work_hours: hoursUsed(v) ? formatHours(hoursOf(v)) : text(v.work_hours),
        severity: v.severity, status: v.status, body: v.body.trim(), detour: text(v.detour),
        affected_businesses: text(v.affected_businesses), photo_paths: k, state,
        // The pin is only sent when there is one, or one is being removed, so advisories without a pin still save
        // before the database has the pin columns.
        ...(pinned || (editing && editing.lat != null) ? { lat: pinned ? pinned.lat : null, lng: pinned ? pinned.lng : null } : {}),
      };
      const saved = await saveAdvisory(editing && editing.id, fields);
      const ok = state === 'Draft' ? `Draft saved: ${saved.title}` : editing ? `Saved: ${saved.title}` : `Published: ${saved.title}`;
      setAdded([]); // nothing left to ask about on the way out
      navigate(LIST, { state: { ok, tab: saved.state } });
    } catch (err) {
      console.error(err);
      setKept(k); setAdded(waiting);
      setFormErr(`Could not save the advisory. ${err.message}`);
      setSaving('');
    }
  };

  const thumbs = [
    ...kept.map((p, i) => ({ src: photoUrl(p), list: 'kept', i })),
    ...added.map((p, i) => ({ src: p.preview, list: 'added', i })),
  ];
  const err = (k, fid) => errs[k] && <p className="err" id={fid}>{errs[k]}</p>;
  const title = id ? 'Edit advisory' : 'New advisory';

  return (
    <section>
      <PageHero kicker="Staff" photo="advisory-viaduct.jpg" title={title}
        sub={id ? (editing ? editing.title : '') : 'Post a construction advisory. Save it as a draft to finish later, or publish it now.'} />
      <Link className="back" to={LIST}><Icon name="back" size={18} />Manage advisories</Link>

      {!ready && !blocked && <p className="mut" role="status" style={{ padding: '24px 0' }}>Loading advisory…</p>}
      {blocked && (
        <div className="card stack" style={{ marginBottom: 28 }}>
          <h2>This advisory cannot be edited</h2>
          <p className="mut">{blocked}</p>
          <Link className="btn s" style={{ alignSelf: 'flex-start' }} to={LIST}>Back to Manage advisories</Link>
        </div>
      )}

      {ready && !blocked && (
        <form className="card stack" noValidate aria-label={title} onSubmit={submit} style={{ marginBottom: 28 }}>
          <div><label htmlFor="mt">Title</label><input id="mt" className="in" maxLength={150} placeholder="e.g. Lane closure on Sample Road B" aria-describedby="mte" {...field('title')} />{err('title', 'mte')}</div>
          <div className="fgrid">
            <div><label htmlFor="mc">Type</label><select id="mc" className="in" {...field('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label htmlFor="mz">Area</label><ZoneSelect id="mz" all="All areas" value={v.zone_id} onChange={(z) => change({ ...v, zone_id: z })} /></div>
            <div><label htmlFor="ms1">Start date</label><input id="ms1" className="in" type="date" aria-describedby="mse" {...field('starts_on')} />{err('starts_on', 'mse')}</div>
            <div><label htmlFor="me1">End date (optional)</label><input id="me1" className="in" type="date" aria-describedby="mde" {...field('ends_on')} />{err('ends_on', 'mde')}</div>
            <div><label htmlFor="mv">Severity</label><select id="mv" className="in" aria-describedby="mvh" {...field('severity')}>{SEVERITY.map((s) => <option key={s}>{s}</option>)}</select><p className="mut hint" id="mvh">High shows it in the urgent banner on every page, from {URGENT_LEAD_DAYS} days before it starts.</p></div>
            <div><label htmlFor="mst">Work status</label><select id="mst" className="in" aria-describedby="msth" {...field('status')}>
              {/* Finished work is ended with the End button, which also marks it Completed. "Completed" only shows
                  here for an older advisory that already has it, so its value is not lost. */}
              {['Planned', 'Ongoing', ...(v.status === 'Completed' ? ['Completed'] : [])].map((s) => <option key={s}>{s}</option>)}
            </select><p className="mut hint" id="msth">When the work finishes, use End on the Manage advisories list.</p></div>
          </div>
          <WorkHoursField v={v} onChange={change} error={errs.work_hours} />
          <fieldset className="stack plain">
            <legend>Location</legend>
            <div><label htmlFor="ml">Where the works are, in words</label><input id="ml" className="in" placeholder="e.g. Jalan Magazine, near Komtar" aria-describedby="mlh" {...field('location')} />
              <p className="mut hint" id="mlh">Then pin it on the map (optional), so the public can see exactly where it is.</p></div>
            <LocationPicker value={pinned} onChange={setPin} onFound={foundPlace} />
          </fieldset>
          <div><label htmlFor="mb">Details</label><textarea id="mb" className="in" rows={4} placeholder="What is happening, and what should people expect?" {...field('body')} /></div>
          <div className="fgrid2">
            <div><label htmlFor="md">Detour and access</label><textarea id="md" className="in" rows={3} placeholder="Detour route, pedestrian access, parking" {...field('detour')} /></div>
            <div><label htmlFor="mbz">Affected businesses</label><textarea id="mbz" className="in" rows={3} placeholder="Shops affected and how customers reach them" {...field('affected_businesses')} /></div>
          </div>
          <div>
            <label htmlFor="mp">Site photos (JPG or PNG, up to 5 MB each, at most 5)</label>
            <div className="thumbs">
              {thumbs.map((t, n) => (
                <figure className="thumb" key={`${t.list}:${t.i}:${t.src}`}>
                  <img src={t.src} alt={`Photo ${n + 1}`} />
                  <button type="button" aria-label={`Remove photo ${n + 1}`} onClick={() => removePhoto(t.list, t.i)}>×</button>
                </figure>
              ))}
            </div>
            <input id="mp" className="in" type="file" accept="image/jpeg,image/png" multiple disabled={thumbs.length >= MAX_PHOTOS} onChange={addPhotos} />
            {photoErr && <p className="err">{photoErr}</p>}
          </div>
          <div className="mactions">
            {!published && <button className="btn s" type="submit" value="Draft" disabled={!!saving}>{saving === 'Draft' ? 'Saving…' : 'Save as draft'}</button>}
            <button className="btn" type="submit" value="Published" disabled={!!saving}>{saving === 'Published' ? 'Saving…' : published ? 'Save changes' : 'Publish'}</button>
            <button className="btn s" type="button" disabled={!!saving} onClick={cancel}>Cancel</button>
          </div>
          {formErr && <p className="err" role="alert">{formErr}</p>}
        </form>
      )}
    </section>
  );
}
