// Ticket page (UC04): everything about one ticket (description, location, photo, reporter, status history),
// and the staff controls for it: priority (UC05), assignee (UC06), status (UC07), a reply the resident
// reads when tracking the ticket (UC08), and escalation to the government (UC09).
// What a person may change depends on their role (ticketRights in tickets.js; the database checks the same rule).
// Address: #/admin/tickets/LRT-2026-0001
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useZones } from '../../shared/ZoneSelect.jsx';
import { useStaff } from '../../shared/staff.jsx';
import usePageTitle from '../../shared/usePageTitle.js';
import { escalateTicket, getTicket, listStaff, replyToTicket, ticketPhotoUrl, updateTicket } from './api.js';
import { NOTE_MAX, PRIORITIES, STATUSES, actionError, assigneeOptions, checkNote, historyItem, reporter, submittedAt, ticketRights } from './tickets.js';

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

// A short text box with its own send button, used for the reply (UC08) and the escalation reason (UC09).
// onSend gets the text; it should throw to show an error. what = 'reply' or 'reason', used in messages.
function NoteForm({ id, label, help, what, button, busyLabel, onSend, onCancel, warn }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    const problem = checkNote(text, what);
    if (problem) { setErr(problem); document.getElementById(id).focus(); return; }
    setBusy(true); setErr('');
    try { await onSend(text); setText(''); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <form className="stack" noValidate onSubmit={send}>
      <div>
        <label htmlFor={id}>{label}</label>
        <textarea id={id} className="in" rows={4} autoFocus={!!onCancel} maxLength={NOTE_MAX} value={text} aria-invalid={!!err}
          aria-describedby={`${id}-help${err ? ` ${id}-err` : ''}`} onChange={(e) => { setText(e.target.value); if (err) setErr(''); }} />
        <p className="mut fhelp" id={`${id}-help`}>{help} <span aria-hidden="true">({text.trim().length}/{NOTE_MAX})</span></p>
        {err && <p className="err" id={`${id}-err`} role="alert">{err}</p>}
      </div>
      <div className="ctas" style={{ justifyContent: 'flex-start', margin: 0 }}>
        <button className={`btn${warn ? ' warn' : ''}`} type="submit" disabled={busy}>{busy ? busyLabel : button}</button>
        {onCancel && <button className="btn s" type="button" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  );
}

export default function TicketPage() {
  const { no } = useParams();
  const { state } = useLocation();
  const back = `/admin${state?.back || ''}`; // back to the dashboard with the same filters
  const { profile } = useStaff();
  const zones = useZones();
  usePageTitle(`Ticket ${no}`);

  const [t, setT] = useState(undefined); // undefined while loading, null when not found
  const [loadErr, setLoadErr] = useState(false);
  const [staff, setStaff] = useState([]);
  const [v, setV] = useState({ priority: '', status: '', assigned_to: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [notice, setNotice] = useState(''); // after a reply or an escalation
  const [escalating, setEscalating] = useState(false);

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
    setT(undefined); setLoadErr(false); setMsg(null); setNotice(''); setEscalating(false);
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
      setMsg({ ok: false, text: actionError(err, 'save the changes') });
    } finally {
      setSaving(false);
    }
  };

  // UC08: the reply is saved, then the page reloads so it shows in the history.
  const reply = async (text) => {
    setNotice('');
    try { await replyToTicket(t.id, text); } catch (e) { console.error(e); throw new Error(actionError(e, 'send the reply')); }
    await load();
    setNotice('Reply sent. The resident sees it when they track this ticket.');
  };
  // UC09: escalating also assigns the ticket to the government officers.
  const escalate = async (text) => {
    setNotice('');
    try { await escalateTicket(t.id, text); } catch (e) { console.error(e); throw new Error(actionError(e, 'escalate the ticket')); }
    setEscalating(false);
    await load();
    setNotice('Ticket escalated to the government officers.');
  };

  const r = ticketRights(profile, t);
  // The Construction Team and Government Officers only open the tickets given to them (as on the dashboard).
  if (!r.handle) {
    return (
      <section className="stack" style={{ padding: '40px 0' }}>
        <h1>This ticket is not given to you</h1>
        <p className="mut">You can only open the complaints given to you. An admin assigns them.</p>
        <Link className="btn" style={{ alignSelf: 'flex-start' }} to={back}>Back to my tickets</Link>
      </section>
    );
  }
  const step = STATUSES.indexOf(t.status);
  const zone = t.zone_id == null ? 'Not given' : (zones.find((z) => z.id === t.zone_id) || {}).name || `Area ${t.zone_id}`;
  return (
    <section>
      <p className="tback"><Link to={back}>← All tickets</Link></p>
      <div className="adv-head">
        <p>
          {t.escalated_at && <><span className="pill esc">Escalated</span> </>}
          {t.priority === 'High' && <><span className="pill hot">High priority</span> </>}
          <span className={`pill ${STATUS_PILL[t.status] || ''}`}>{t.status}</span> <span className="pill">{t.category}</span>
        </p>
        <h1>{t.ticket_no}</h1>
        <p className="mut adv-sub">Submitted {submittedAt(t.created_at)}</p>
      </div>
      <div className="adv">
        <div className="stack">
          <div className="card"><h2>The complaint</h2><p><Para text={t.description} /></p></div>
          <div className="card"><h2>Photo</h2>
            {t.photo_path ? <Photo path={t.photo_path} alt={`Photo sent with ${t.ticket_no}`} /> : <p className="mut">No photo was sent.</p>}
          </div>
          {notice && <p className="ok" role="status">{notice}</p>}
          <div className="card"><h2>History</h2>
            <ol className="thist">
              {t.history.map((h) => {
                const item = historyItem(h);
                return (
                  <li key={h.id} className={h.kind && h.kind !== 'status' ? `k-${h.kind}` : undefined}>
                    <b>{item.title}</b> <span className="mut">· {submittedAt(h.created_at)}</span>
                    {item.note && <span className="hnote"><Para text={item.note} /></span>}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="card stack"><h2>Reply to the resident</h2>
            {r.handle ? (
              <NoteForm id="rr" label="Your reply" what="reply" button="Send reply" busyLabel="Sending…" onSend={reply}
                help="The resident reads this on the Feedback page when they track this ticket, so write it for them." />
            ) : <p className="mut">Only the staff this ticket is assigned to, or an admin, can reply.</p>}
          </div>
        </div>
        <aside className="stack">
          <div className="card"><h2>Key facts</h2>
            <dl className="facts">
              <dt>Category</dt><dd>{t.category}</dd>
              <dt>Location</dt><dd>{t.location || 'Not given'}</dd>
              <dt>Area</dt><dd>{zone}</dd>
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
            {!r.manage && <p className="mut small">{r.handle ? 'You can change the status. Priority and assignment are set by an admin.' : 'This ticket is not assigned to you, so it is read-only for you.'}</p>}
            <div><label htmlFor="mp">Priority</label>
              <select id="mp" className="in" value={v.priority} disabled={!r.manage} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label htmlFor="ma">Assigned to</label>
              <select id="ma" className="in" value={v.assigned_to} disabled={!r.manage} onChange={set('assigned_to')}>
                <option value="">Unassigned</option>
                {assigneeOptions(staff, t.assigned_to).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
            <div><label htmlFor="mst">Status</label>
              <select id="mst" className="in" value={v.status} disabled={!r.handle} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }} disabled={!changed || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            {msg && <p className={msg.ok ? 'ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
          </form>
          <div className="card stack"><h2>Escalate to the government</h2>
            {t.escalated_at ? (
              <>
                <p>Escalated on {submittedAt(t.escalated_at)}.</p>
                {t.escalation_reason && <p className="mut"><b>Reason:</b> <Para text={t.escalation_reason} /></p>}
              </>
            ) : !r.manage ? (
              <p className="mut">Only an admin can escalate a ticket.</p>
            ) : escalating ? (
              <NoteForm id="er" label="Why does this need the government?" what="reason" button="Escalate ticket" busyLabel="Escalating…"
                help="Only staff see the reason. The ticket is assigned to the Government Officers." warn onSend={escalate} onCancel={() => setEscalating(false)} />
            ) : (
              <>
                <p className="mut">For problems beyond the project team, such as public roads, utilities or enforcement.</p>
                <button type="button" className="btn warn" style={{ alignSelf: 'flex-start' }} onClick={() => setEscalating(true)}>Escalate…</button>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
