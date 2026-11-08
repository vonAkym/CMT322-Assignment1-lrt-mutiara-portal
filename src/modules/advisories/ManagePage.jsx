// My advisories (UC06 to UC08): staff post new advisories, edit drafts and published ones,
// publish drafts and end advisories when the work finishes.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import ZoneSelect from '../../shared/ZoneSelect.jsx';
import { isPhotoOk } from '../../shared/supabase.js';
import { CATS, SEVERITY, dateRange, ago, todayISO } from '../../shared/util.js';
import { myProfile } from '../admin/api.js';
import { listMyAdvisories, saveAdvisory, publishAdvisory, endAdvisory, uploadAdvisoryPhoto, photoUrl, isOverdue } from './api.js';
import PageHero from '../../shared/PageHero.jsx';

const MAX_PHOTOS = 5;
const STATES = [['Draft', 'Drafts'], ['Published', 'Published'], ['Ended', 'Ended']];
// Form fields, named after their database columns.
const EMPTY = {
  title: '', category: CATS[0], zone_id: '', location: '', starts_on: '', ends_on: '', work_hours: '',
  severity: 'Low', status: 'Planned', body: '', detour: '', affected_businesses: '',
};

// Returns the problems in the form, e.g. { title: '...' }. Empty when the form is fine.
function validate(v) {
  const e = {}, title = v.title.trim();
  if (title.length < 3 || title.length > 150) e.title = 'Enter a title of 3 to 150 characters.';
  if (!v.starts_on) e.starts_on = 'Choose the start date.';
  if (v.starts_on && v.ends_on && v.ends_on < v.starts_on) e.ends_on = 'The end date must be on or after the start date.';
  return e;
}
const FIELD_ID = { title: 'mt', starts_on: 'ms1', ends_on: 'me1' };

function Actions({ a, busy, onAct }) {
  const b = (act, label, cls = 's') => (
    <button type="button" className={`btn ${cls} sm`} disabled={busy} aria-label={`${label}: ${a.title}`} onClick={() => onAct(act, a)}>{label}</button>
  );
  if (a.state === 'Draft') return <>{b('edit', 'Edit')}{b('publish', 'Publish', '')}</>;
  if (a.state === 'Published') return <>{b('view', 'View')}{b('edit', 'Edit')}{b('end', 'End', 'warn')}</>;
  return b('view', 'View');
}

export default function ManagePage() {
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  const [tab, setTab] = useState('Published');
  const [okMsg, setOkMsg] = useState('');
  const [listErr, setListErr] = useState('');
  const [busyRow, setBusyRow] = useState(null);
  const [demo, setDemo] = useState(false);

  // Form state. editing is the advisory being changed, or null for a new one.
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [v, setV] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [kept, setKept] = useState([]);   // photo paths already saved with the advisory
  const [added, setAdded] = useState([]); // new photos waiting to be uploaded: { file, preview }
  const [photoErr, setPhotoErr] = useState('');
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(''); // the button being saved with ('Draft' or 'Published')
  const formRef = useRef(null);
  const addedRef = useRef(added);
  addedRef.current = added;

  const load = async () => {
    setListErr('');
    try { setAll(await listMyAdvisories()); } catch (e) {
      console.error(e); setAll([]);
      setListErr('Could not load advisories. Please try again later.');
    }
  };

  useEffect(() => {
    load();
    myProfile().then((p) => setDemo(!p), (e) => { console.error(e); setDemo(true); });
    return () => addedRef.current.forEach((p) => URL.revokeObjectURL(p.preview)); // free photo previews on leaving
  }, []);

  // ---------- Form (UC06 and editing) ----------
  const openForm = (a) => {
    added.forEach((p) => URL.revokeObjectURL(p.preview));
    setEditing(a || null);
    setV(a ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, a[k] == null ? '' : String(a[k])])) : { ...EMPTY, starts_on: todayISO() });
    setKept(a ? [...(a.photo_paths || [])] : []);
    setAdded([]);
    setErrs({}); setPhotoErr(''); setFormErr(''); setOkMsg('');
    setOpen(true);
  };
  // Scroll to the form and put the cursor in the title each time it opens.
  useEffect(() => {
    if (!open) return;
    formRef.current.scrollIntoView({ block: 'start' });
    document.getElementById('mt').focus({ preventScroll: true });
  }, [open, editing]);

  const closeForm = () => {
    added.forEach((p) => URL.revokeObjectURL(p.preview));
    setAdded([]); setKept([]); setEditing(null); setOpen(false);
  };

  const field = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) });

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

  const submit = async (e) => {
    e.preventDefault();
    // Pressing Enter uses the first submit button. Save as draft comes first so Enter never publishes by accident;
    // when it is hidden (editing a published advisory) the advisory simply stays published.
    const submitter = e.nativeEvent.submitter;
    const state = submitter && submitter.value === 'Draft' && !published ? 'Draft' : 'Published';
    const problems = validate(v);
    setErrs(problems);
    const bad = ['title', 'starts_on', 'ends_on'].find((k) => problems[k]);
    if (bad) { document.getElementById(FIELD_ID[bad]).focus(); return; }
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
        location: text(v.location), starts_on: v.starts_on, ends_on: v.ends_on || null, work_hours: text(v.work_hours),
        severity: v.severity, status: v.status, body: v.body.trim(), detour: text(v.detour),
        affected_businesses: text(v.affected_businesses), photo_paths: k, state,
      };
      const wasNew = !editing;
      const saved = await saveAdvisory(editing && editing.id, fields);
      setAdded([]); setKept([]); setEditing(null); setOpen(false);
      setTab(saved.state);
      await load();
      setOkMsg(state === 'Draft' ? `Draft saved: ${saved.title}` : wasNew ? `Published: ${saved.title}` : `Saved: ${saved.title}`);
    } catch (err) {
      console.error(err);
      setKept(k); setAdded(waiting);
      setFormErr(`Could not save the advisory. ${err.message}`);
    } finally {
      setSaving('');
    }
  };

  // ---------- Row buttons: view, edit, publish, end (UC08) ----------
  const onAct = async (act, a) => {
    if (act === 'view') { navigate(`/advisories/${a.id}`); return; }
    if (act === 'edit') { openForm(a); return; }
    if (act === 'end' && !window.confirm(`End "${a.title}"?\n\nUse this when the work has finished. The advisory moves to the ended archive and shows as completed.`)) return;
    setBusyRow(a.id); setOkMsg(''); setListErr('');
    try {
      if (act === 'publish') { await publishAdvisory(a.id); setTab('Published'); } else { await endAdvisory(a.id); setTab('Ended'); }
      await load();
      setOkMsg(`${act === 'publish' ? 'Published' : 'Ended'}: ${a.title}`);
    } catch (err) {
      console.error(err);
      setListErr(`Could not ${act} the advisory. ${err.message}`);
    } finally {
      setBusyRow(null);
    }
  };

  const rows = all.filter((a) => a.state === tab);
  // Published advisories past their end date: the public already sees them as ended, but staff should confirm.
  const overdue = all.filter(isOverdue).length;
  const thumbs = [
    ...kept.map((p, i) => ({ src: photoUrl(p), list: 'kept', i })),
    ...added.map((p, i) => ({ src: p.preview, list: 'added', i })),
  ];
  const err = (k, id) => errs[k] && <p className="err" id={id}>{errs[k]}</p>;

  return (
    <section>
      <PageHero kicker="Staff" photo="advisory-viaduct.jpg" title="My advisories" sub="Post, edit, publish and end construction advisories.">
        <div className="ctas" style={{ justifyContent: 'flex-start' }}><button type="button" className="btn gold" onClick={() => openForm()}>+ New advisory</button></div>
      </PageHero>
      {demo && <p className="note"><b>Demo mode.</b> Staff sign-in is not connected yet, so this page lists every advisory. Saving works only after <code>supabase/dev/demo_without_signin.sql</code> has been run in Supabase (see SETUP.md).</p>}

      {open && (
        <form className="card stack" ref={formRef} noValidate aria-labelledby="mftitle" onSubmit={submit}>
          <h2 id="mftitle">{editing ? `Edit: ${editing.title}` : 'New advisory'}</h2>
          <div><label htmlFor="mt">Title</label><input id="mt" className="in" maxLength={150} placeholder="e.g. Lane closure on Sample Road B" aria-describedby="mte" {...field('title')} />{err('title', 'mte')}</div>
          <div className="fgrid">
            <div><label htmlFor="mc">Type</label><select id="mc" className="in" {...field('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label htmlFor="mz">Area</label><ZoneSelect id="mz" all="All areas" value={v.zone_id} onChange={(z) => setV({ ...v, zone_id: z })} /></div>
            <div><label htmlFor="ml">Location</label><input id="ml" className="in" placeholder="Street or landmark" {...field('location')} /></div>
            <div><label htmlFor="ms1">Start date</label><input id="ms1" className="in" type="date" aria-describedby="mse" {...field('starts_on')} />{err('starts_on', 'mse')}</div>
            <div><label htmlFor="me1">End date (optional)</label><input id="me1" className="in" type="date" aria-describedby="mde" {...field('ends_on')} />{err('ends_on', 'mde')}</div>
            <div><label htmlFor="mh">Work hours</label><input id="mh" className="in" placeholder="e.g. 9 am to 5 pm, Monday to Saturday" {...field('work_hours')} /></div>
            <div><label htmlFor="mv">Severity</label><select id="mv" className="in" aria-describedby="mvh" {...field('severity')}>{SEVERITY.map((s) => <option key={s}>{s}</option>)}</select><p className="mut hint" id="mvh">High shows it in the urgent banner on every page.</p></div>
            <div><label htmlFor="mst">Work status</label><select id="mst" className="in" {...field('status')}><option>Planned</option><option>Ongoing</option><option>Completed</option></select></div>
          </div>
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
            <button className="btn s" type="button" disabled={!!saving} onClick={closeForm}>Cancel</button>
          </div>
          {formErr && <p className="err" role="alert">{formErr}</p>}
        </form>
      )}

      <div className="tabs" role="group" aria-label="Show advisories by state">
        {STATES.map(([state, label]) => (
          <button type="button" key={state} aria-pressed={tab === state} onClick={() => { setTab(state); setOkMsg(''); }}>
            {label} <span>{all.filter((a) => a.state === state).length}</span>
          </button>
        ))}
      </div>
      {tab === 'Published' && overdue > 0 && (
        <p className="note"><b>{overdue} published advisor{overdue === 1 ? 'y has' : 'ies have'} passed the end date.</b> The public
          already sees {overdue === 1 ? 'it' : 'them'} as ended. Press End if the work has finished, or Edit to move the end date if it is running late.</p>
      )}
      {okMsg && <p className="ok" role="status">{okMsg}</p>}
      {listErr && <p className="err" role="alert">{listErr}</p>}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Advisory</th><th>Type</th><th>Area</th><th>Dates</th><th>Updated</th><th><span className="vh">Actions</span></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><b>{a.title}</b>{a.severity === 'High' && <> <span className="pill hot">Urgent</span></>}
                  {isOverdue(a) && <> <span className="pill late">Past end date</span></>}<br />
                  <span className="mut">{a.status}{a.location ? ` · ${a.location}` : ''}</span></td>
                <td>{a.category}</td><td>{a.zones ? a.zones.name : 'All areas'}</td>
                <td>{dateRange(a.starts_on, a.ends_on)}</td><td>{ago(a.updated_at)}</td>
                <td className="acts"><Actions a={a} busy={busyRow === a.id} onAct={onAct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="mut" style={{ padding: 16 }}>No advisories here yet.</p>}
      </div>
      <div style={{ height: 28 }} />
    </section>
  );
}
