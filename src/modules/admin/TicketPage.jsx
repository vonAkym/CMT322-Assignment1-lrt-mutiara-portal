// Ticket page (UC04): everything about one ticket (description, location, photo, reporter, status history),
// and the staff controls for it: priority (UC05), assignee (UC06) and status (UC07).
// Address: #/admin/tickets/LRT-2026-0001
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { getTicket, listStaff, ticketPhotoUrl, updateTicket } from './api.js';
import { PRIORITIES, STATUSES, assigneeOptions, reporter, submittedAt } from './tickets.js';

const Para = ({ text }) => text.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>);
const STATUS_PILL = { 'In progress': 'on', Resolved: 'dn' };

function Photo({ path, alt }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    ticketPhotoUrl(path).then((u) => { if (live) setSrc(u); }, (e) => { console.error(e); if (live) setFailed(true); });
    return () => { live = false; };
  }, [path]);
  if (failed) return <p className="mut">The photo could not be loaded.</p>;
  if (!src) return <p className="mut">Loading photo…</p>;
  return <a href={src} target="_blank" rel="noopener"><img className="tphoto" src={src} alt={alt} /></a>;
}

export default function TicketPage() {
  const { no } = useParams();
  const { state } = useLocation();
  const back = `/admin${state?.back || ''}`; // back to the dashboard with the same filters

  const [t, setT] = useState(undefined); // undefined while loading, null when not found
  const [loadErr, setLoadErr] = useState(false);
  const [staff, setStaff] = useState([]);
  const [v, setV] = useState({ priority: '', status: '', assigned_to: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const found = await getTicket(no);
      setT(found);
      if (found) setV({ priority: found.priority, status: found.status, assigned_to: found.assigned_to || '' });
    } catch (e) {
      console.error(e); setLoadErr(true); setT(null);
    }
  };
  useEffect(() => {
    setT(undefined); setLoadErr(false); setMsg(null);
    load();
    listStaff().then(setStaff, (e) => console.error(e));
  }, [no]);

  if (t === undefined) return <p className="mut" role="status" style={{ padding: '40px 0' }}>Loading ticket…</p>;
  if (!t) {
    return (
      <section className="stack" style={{ padding: '40px 0' }}>
        <h1>{loadErr ? 'Could not load this ticket' : `No ticket ${no}`}</h1>
        <p className="mut">{loadErr ? 'Please try again later.' : 'Check the number, or find the ticket on the dashboard.'}</p>
        <Link className="btn" style={{ alignSelf: 'flex-start' }} to={back}>Back to all tickets</Link>
      </section>
    );
  }

  const changed = v.priority !== t.priority || v.status !== t.status || (v.assigned_to || null) !== (t.assigned_to || null);
  const set = (k) => (e) => { setV({ ...v, [k]: e.target.value }); setMsg(null); };

  const save = async (e) => {
    e.preventDefault();
    if (!changed) return;
    const changes = {};
    if (v.priority !== t.priority) changes.priority = v.priority;
    if (v.status !== t.status) changes.status = v.status;
    if ((v.assigned_to || null) !== (t.assigned_to || null)) changes.assigned_to = v.assigned_to || null;
    setSaving(true); setMsg(null);
    try {
      await updateTicket(t.id, changes);
      await load(); // brings in the new status history entry the database adds
      setMsg({ ok: true, text: 'Changes saved.' });
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: 'Could not save the changes. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const step = STATUSES.indexOf(t.status);
  return (
    <section>
      <p className="tback"><Link to={back}>← All tickets</Link></p>
      <div className="adv-head">
        <p>
          {t.priority === 'High' && <><span className="pill hot">High priority</span> </>}
          <span className={`pill ${STATUS_PILL[t.status] || ''}`}>{t.status}</span> <span className="pill">{t.category}</span>
        </p>
        <h1>{t.ticket_no}</h1>
        <p className="mut adv-sub">Submitted {submittedAt(t.created_at)}</p>
      </div>
      <div className="adv">
        <div className="stack">
          <div className="card"><h2>The concern</h2><p><Para text={t.description} /></p></div>
          <div className="card"><h2>Photo</h2>
            {t.photo_path ? <Photo path={t.photo_path} alt={`Photo sent with ${t.ticket_no}`} /> : <p className="mut">No photo was sent.</p>}
          </div>
          <div className="card"><h2>Status history</h2>
            <ol className="thist">
              {t.history.map((h) => (
                <li key={h.id}><b>{h.status}</b> <span className="mut">· {submittedAt(h.created_at)}</span>{h.note && <><br />{h.note}</>}</li>
              ))}
            </ol>
          </div>
        </div>
        <aside className="stack">
          <div className="card"><h2>Key facts</h2>
            <dl className="facts">
              <dt>Category</dt><dd>{t.category}</dd>
              <dt>Location</dt><dd>{t.location || 'Not given'}</dd>
              <dt>Reported by</dt><dd>{reporter(t)}</dd>
              <dt>Submitted</dt><dd>{submittedAt(t.created_at)}</dd>
              <dt>Assigned to</dt><dd>{t.assigned_to || 'Unassigned'}</dd>
            </dl>
            <div style={{ marginTop: 14 }}>
              {STATUSES.map((s, k) => <div className={`step${k <= step ? ' d' : ''}`} key={s}><i /><span style={k === step ? { fontWeight: 600 } : undefined}>{s}</span></div>)}
            </div>
          </div>
          <form className="card stack" onSubmit={save}>
            <h2>Manage this ticket</h2>
            <div><label htmlFor="mp">Priority</label>
              <select id="mp" className="in" value={v.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label htmlFor="ma">Assigned to</label>
              <select id="ma" className="in" value={v.assigned_to} onChange={set('assigned_to')}>
                <option value="">Unassigned</option>
                {assigneeOptions(staff, t.assigned_to).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
            <div><label htmlFor="mst">Status</label>
              <select id="mst" className="in" value={v.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }} disabled={!changed || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            {msg && <p className={msg.ok ? 'ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
          </form>
        </aside>
      </div>
    </section>
  );
}
