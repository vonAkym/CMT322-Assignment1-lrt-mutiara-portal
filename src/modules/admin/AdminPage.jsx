// Operational dashboard (Module 4): every complaint ticket from the database.
// UC02 view the list, UC03 search and filter it (including by area and escalated tickets, UC09),
// UC05 to UC07 set priority, assignee and status straight from the list (as far as the person's role allows),
// UC10 the figures (counts by status, category and area, average first response), UC11 download or print them.
// Selecting a ticket number opens its page (UC04). Admins also reach Manage staff roles (UC12) from here.
// The filters live in the address (e.g. #/admin?status=Submitted), so the back button and refresh keep them.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import PageHero from '../../shared/PageHero.jsx';
import { useZones } from '../../shared/ZoneSelect.jsx';
import { ROLE_NAMES, useStaff } from '../../shared/staff.jsx';
import usePageTitle from '../../shared/usePageTitle.js';
import { todayISO } from '../../shared/util.js';
import { listStaff, listTicketEvents, listTickets, updateTicket } from './api.js';
import {
  CATEGORIES, PRIORITIES, STATUSES, FILTER_KEYS, actionError, assigneeOptions, countBy, duration, filterTickets,
  readFilters, responseStats, submittedAt, summaryReport, ticketRights,
} from './tickets.js';

const Select = ({ label, value, onChange, disabled, title, children }) => (
  <select className="in" aria-label={label} value={value} disabled={disabled} title={title} onChange={(e) => onChange(e.target.value)}>{children}</select>
);

// Bars for one breakdown (by category, by area). counts: { name: number }.
const Bars = ({ title, counts }) => {
  const most = Math.max(1, ...Object.values(counts));
  return (
    <div className="card"><h2>{title}</h2>
      {Object.entries(counts).map(([k, n]) => (
        <div className="bar" key={k}><span>{k}</span><i style={{ width: `${(n / most) * 60}%` }} />{n}</div>
      ))}
    </div>
  );
};

// What a staff member who is not an admin may do, in one sentence.
const ROLE_HELP = {
  construction: 'As Construction Team you can change the status of, and reply to, tickets given to the Construction Team or to you by name.',
  government: 'As a Government Officer you can change the status of, and reply to, escalated tickets and tickets given to the Government Officers or to you by name.',
};

// Saves text as a file in the visitor's Downloads folder.
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminPage() {
  usePageTitle('Operational dashboard');
  const navigate = useNavigate();
  const { search } = useLocation();
  const { profile } = useStaff();
  const zones = useZones();
  const [params, setParams] = useSearchParams();
  const f = readFilters(params);
  const setFilter = (k, v) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (v) n.set(k, v); else n.delete(k);
    return n;
  }, { replace: true });

  const [tickets, setTickets] = useState(null); // null while loading
  const [loadErr, setLoadErr] = useState(false);
  const [events, setEvents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(null); // id of the ticket being saved
  const [msg, setMsg] = useState(null);       // { ok, text } after a change

  useEffect(() => {
    let live = true;
    listTickets().then((l) => { if (live) setTickets(l); }, (e) => { console.error(e); if (live) { setTickets([]); setLoadErr(true); } });
    listTicketEvents().then((l) => { if (live) setEvents(l); }, (e) => console.error(e)); // only the response figures need it
    listStaff().then((s) => { if (live) setStaff(s); }, (e) => console.error(e)); // without it, only the teams are offered
    return () => { live = false; };
  }, []);

  // The keyword box waits until typing stops for 0.3 s before filtering.
  const [q, setQ] = useState(f.q);
  useEffect(() => { setQ(f.q); }, [f.q]);
  useEffect(() => {
    if (q === f.q) return undefined;
    const t = setTimeout(() => setFilter('q', q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // UC05 to UC07: the change shows at once and is saved; if saving fails, the old value comes back.
  const change = async (t, field, value) => {
    const before = tickets;
    setTickets(tickets.map((x) => (x.id === t.id ? { ...x, [field]: value || null } : x)));
    setSaving(t.id); setMsg(null);
    try {
      const saved = await updateTicket(t.id, { [field]: value || null });
      setTickets((list) => list.map((x) => (x.id === t.id ? saved : x)));
      if (field === 'status') listTicketEvents().then(setEvents, (e) => console.error(e)); // a new history entry
      setMsg({ ok: true, text: `Saved ${t.ticket_no}.` });
    } catch (e) {
      console.error(e);
      setTickets(before);
      setMsg({ ok: false, text: actionError(e, `save ${t.ticket_no}`) });
    } finally {
      setSaving(null);
    }
  };

  const zoneName = (id) => (id == null ? 'No area given' : (zones.find((z) => z.id === id) || {}).name || `Area ${id}`);
  const all = tickets || [];
  const shown = filterTickets(all, f, profile);
  const byStatus = countBy(all, 'status', STATUSES);
  const byZone = {};
  [...zones.map((z) => z.name), 'No area given'].forEach((n) => { byZone[n] = 0; });
  all.forEach((t) => { const n = zoneName(t.zone_id); byZone[n] = (byZone[n] || 0) + 1; });
  const resp = responseStats(all, events);
  const filtered = FILTER_KEYS.some((k) => f[k]);
  const people = assigneeOptions(staff);
  const admin = profile?.role === 'admin';

  // UC11: the figures and the tickets on screen (with the current filters) as a spreadsheet file.
  const exportCsv = () => {
    const csv = summaryReport({ tickets: shown, events, zoneName, filters: Object.fromEntries(FILTER_KEYS.map((k) => [k, f[k]])) });
    download(`mutiarainfo-tickets-${todayISO()}.csv`, `﻿${csv}`, 'text/csv;charset=utf-8'); // the mark makes Excel read UTF-8
  };

  return (
    <section className="dash">
      <PageHero kicker="Staff" title="Operational dashboard" sub="Every concern from residents and businesses, with its priority, owner and progress." />
      <div className="stack" style={{ paddingBottom: 28 }}>
        {profile && (
          <p className="mut signed">Signed in as <b>{profile.full_name || 'staff member'}</b> ({ROLE_NAMES[profile.role] || profile.role}).
            {!admin && <> {ROLE_HELP[profile.role]} Priority, assignment and escalation are set by an admin.</>}</p>
        )}
        <p className="print-only">Printed {submittedAt(new Date())}{filtered ? ` · filters: ${FILTER_KEYS.filter((k) => f[k]).map((k) => `${k} ${f[k]}`).join(', ')}` : ''}</p>

        <h2 className="vh">Tickets by status</h2>
        <div className="stats">
          <button type="button" className="card stat" aria-pressed={!f.status} onClick={() => setFilter('status', '')}>
            <span className="mut">Total</span><b>{tickets ? all.length : '–'}</b>
          </button>
          {STATUSES.map((s) => (
            <button type="button" className="card stat" key={s} aria-pressed={f.status === s} onClick={() => setFilter('status', f.status === s ? '' : s)}>
              <span className="mut">{s}</span><b>{tickets ? byStatus[s] : '–'}</b>
            </button>
          ))}
        </div>
        <h2 className="vh">Response</h2>
        <div className="stats">
          <div className="card"><span className="mut">Average first response</span><b>{tickets ? duration(resp.average) : '–'}</b>
            <span className="mut small">over {resp.answered} answered ticket{resp.answered === 1 ? '' : 's'}</span></div>
          <div className="card"><span className="mut">Waiting for a first response</span><b>{tickets ? resp.waiting : '–'}</b></div>
          <button type="button" className="card stat" aria-pressed={!!f.escalated} onClick={() => setFilter('escalated', f.escalated ? '' : '1')}>
            <span className="mut">Escalated to the government</span><b>{tickets ? all.filter((t) => t.escalated_at).length : '–'}</b>
          </button>
          <div className="card"><span className="mut">Open and high priority</span>
            <b>{tickets ? all.filter((t) => t.priority === 'High' && t.status !== 'Resolved').length : '–'}</b></div>
        </div>

        <div className="tcharts">
          <Bars title="Tickets by category" counts={countBy(all, 'category', CATEGORIES)} />
          <Bars title="Tickets by area" counts={byZone} />
        </div>

        <div className="card stack noprint">
          <h2>Reports and tools</h2>
          <p className="mut">The report holds the figures and the tickets that match the filters below.</p>
          <div className="ctas" style={{ justifyContent: 'flex-start', margin: 0 }}>
            <button type="button" className="btn" onClick={exportCsv} disabled={!tickets}>Download report (CSV)</button>
            <button type="button" className="btn s" onClick={() => window.print()} disabled={!tickets}>Print or save as PDF</button>
            <button type="button" className="btn s" onClick={() => navigate('/manage')}>Manage advisories</button>
            {admin && <button type="button" className="btn s" onClick={() => navigate('/admin/staff')}>Manage staff roles</button>}
          </div>
        </div>

        <div className="card stack noprint">
          <h2>Find tickets</h2>
          <div className="tfilters">
            <div><label htmlFor="tq">Search</label>
              <input id="tq" className="in" type="search" placeholder="Ticket number, words, place or name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div><label htmlFor="tc">Category</label>
              <select id="tc" className="in" value={f.category} onChange={(e) => setFilter('category', e.target.value)}>
                <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div><label htmlFor="tz">Area</label>
              <select id="tz" className="in" value={f.zone} onChange={(e) => setFilter('zone', e.target.value)}>
                <option value="">All areas</option><option value="none">No area given</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select></div>
            <div><label htmlFor="ts">Status</label>
              <select id="ts" className="in" value={f.status} onChange={(e) => setFilter('status', e.target.value)}>
                <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div><label htmlFor="tp">Priority</label>
              <select id="tp" className="in" value={f.priority} onChange={(e) => setFilter('priority', e.target.value)}>
                <option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select></div>
            <div><label htmlFor="ta">Assigned to</label>
              <select id="ta" className="in" value={f.assigned} onChange={(e) => setFilter('assigned', e.target.value)}>
                <option value="">Anyone</option>
                {!admin && <option value="mine">Tickets I can work on</option>}
                <option value="none">Unassigned</option>
                {people.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
          </div>
          <label className="chk"><input type="checkbox" checked={!!f.escalated} onChange={(e) => setFilter('escalated', e.target.checked ? '1' : '')} /> Escalated to the government only</label>
          {filtered && <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</button>}
        </div>

        <div>
          <p className="mut" role="status">{tickets && !loadErr ? `${filtered ? `${shown.length} of ${all.length}` : all.length} ticket${all.length === 1 ? '' : 's'}` : ''}</p>
          {msg && <p className={msg.ok ? 'ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
          {!tickets && <p className="mut">Loading tickets…</p>}
          {loadErr && <p className="err" role="alert">Could not load the tickets. Please try again later.</p>}
          {tickets && !loadErr && !all.length && <p className="mut">No tickets yet. Concerns sent from the Report page appear here.</p>}
          {tickets && !!all.length && !shown.length && <p className="mut">No tickets match these filters.</p>}
          {!!shown.length && (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="tickets">
                <thead><tr><th>Ticket</th><th>Category</th><th>Issue</th><th>Area</th><th>Submitted</th><th>Priority</th><th>Status</th><th>Assigned to</th></tr></thead>
                <tbody>
                  {shown.map((t) => {
                    const r = ticketRights(profile, t), busy = saving === t.id;
                    const why = r.handle ? undefined : 'This ticket is not assigned to you';
                    return (
                      <tr key={t.id} className={t.priority === 'High' && t.status !== 'Resolved' ? 'hi' : undefined}>
                        <td className="tno"><Link to={`/admin/tickets/${t.ticket_no}`} state={{ back: search }}>{t.ticket_no}</Link>
                          {t.escalated_at && <><br /><span className="pill esc">Escalated</span></>}</td>
                        <td>{t.category}</td>
                        <td className="issue">{t.description}<br /><span className="mut">{t.location || 'No location given'}</span></td>
                        <td>{zoneName(t.zone_id)}</td>
                        <td className="when">{submittedAt(t.created_at)}</td>
                        <td><Select label={`Priority for ${t.ticket_no}`} value={t.priority} disabled={busy || !r.manage} title={r.manage ? undefined : 'Set by an admin'} onChange={(v) => change(t, 'priority', v)}>
                          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></td>
                        <td><Select label={`Status for ${t.ticket_no}`} value={t.status} disabled={busy || !r.handle} title={why} onChange={(v) => change(t, 'status', v)}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></td>
                        <td><Select label={`Assignee for ${t.ticket_no}`} value={t.assigned_to || ''} disabled={busy || !r.manage} title={r.manage ? undefined : 'Set by an admin'} onChange={(v) => change(t, 'assigned_to', v)}>
                          <option value="">Unassigned</option>
                          {assigneeOptions(staff, t.assigned_to).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
