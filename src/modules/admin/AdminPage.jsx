// Operational dashboard (Module 4): every complaint ticket from the database.
// UC02 view the list, UC03 search and filter it, UC05 to UC07 set priority, assignee and status straight from the list,
// UC10 (first part) counts by status and category. Selecting a ticket number opens its page (UC04).
// The filters live in the address (e.g. #/admin?status=Submitted), so the back button and refresh keep them.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import PageHero from '../../shared/PageHero.jsx';
import { listStaff, listTickets, updateTicket } from './api.js';
import { CATEGORIES, PRIORITIES, STATUSES, FILTER_KEYS, assigneeOptions, countBy, filterTickets, readFilters, submittedAt } from './tickets.js';

const Select = ({ label, value, onChange, disabled, children }) => (
  <select className="in" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{children}</select>
);

export default function AdminPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();
  const f = readFilters(params);
  const setFilter = (k, v) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (v) n.set(k, v); else n.delete(k);
    return n;
  }, { replace: true });

  const [tickets, setTickets] = useState(null); // null while loading
  const [loadErr, setLoadErr] = useState(false);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(null); // id of the ticket being saved
  const [msg, setMsg] = useState(null);       // { ok, text } after a change

  useEffect(() => {
    let live = true;
    listTickets().then((l) => { if (live) setTickets(l); }, (e) => { console.error(e); if (live) { setTickets([]); setLoadErr(true); } });
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
      setMsg({ ok: true, text: `Saved ${t.ticket_no}.` });
    } catch (e) {
      console.error(e);
      setTickets(before);
      setMsg({ ok: false, text: `Could not save ${t.ticket_no}. Please try again.` });
    } finally {
      setSaving(null);
    }
  };

  const all = tickets || [];
  const shown = filterTickets(all, f);
  const byStatus = countBy(all, 'status', STATUSES);
  const byCat = countBy(all, 'category', CATEGORIES);
  const most = Math.max(1, ...Object.values(byCat));
  const filtered = FILTER_KEYS.some((k) => f[k]);
  const people = assigneeOptions(staff);

  return (
    <section>
      <PageHero kicker="Staff" title="Operational dashboard" sub="Every concern from residents and businesses, with its priority, owner and progress." />
      <div className="stack" style={{ paddingBottom: 28 }}>
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

        <div className="row r3" style={{ padding: 0 }}>
          <div className="card"><h2>Tickets by category</h2>
            {CATEGORIES.map((c) => (
              <div className="bar" key={c}><span style={{ width: 120 }}>{c}</span><i style={{ width: `${(byCat[c] / most) * 60}%` }} />{byCat[c]}</div>
            ))}
          </div>
          <div className="card stack" style={{ alignSelf: 'start' }}>
            <h2>Construction advisories</h2>
            <p className="mut">Advisories are posted, edited and ended on the My advisories page.</p>
            <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/manage')}>Open My advisories</button>
          </div>
        </div>

        <div className="card stack">
          <h2>Find tickets</h2>
          <div className="tfilters">
            <div><label htmlFor="tq">Search</label>
              <input id="tq" className="in" type="search" placeholder="Ticket number, words, place or name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div><label htmlFor="tc">Category</label>
              <select id="tc" className="in" value={f.category} onChange={(e) => setFilter('category', e.target.value)}>
                <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
                <option value="">Anyone</option><option value="none">Unassigned</option>
                {people.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
          </div>
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
                <thead><tr><th>Ticket</th><th>Category</th><th>Issue</th><th>Submitted</th><th>Priority</th><th>Status</th><th>Assigned to</th></tr></thead>
                <tbody>
                  {shown.map((t) => (
                    <tr key={t.id} className={t.priority === 'High' && t.status !== 'Resolved' ? 'hi' : undefined}>
                      <td className="tno"><Link to={`/admin/tickets/${t.ticket_no}`} state={{ back: search }}>{t.ticket_no}</Link></td>
                      <td>{t.category}</td>
                      <td className="issue">{t.description}<br /><span className="mut">{t.location || 'No location given'}</span></td>
                      <td className="when">{submittedAt(t.created_at)}</td>
                      <td><Select label={`Priority for ${t.ticket_no}`} value={t.priority} disabled={saving === t.id} onChange={(v) => change(t, 'priority', v)}>
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></td>
                      <td><Select label={`Status for ${t.ticket_no}`} value={t.status} disabled={saving === t.id} onChange={(v) => change(t, 'status', v)}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></td>
                      <td><Select label={`Assignee for ${t.ticket_no}`} value={t.assigned_to || ''} disabled={saving === t.id} onChange={(v) => change(t, 'assigned_to', v)}>
                        <option value="">Unassigned</option>
                        {assigneeOptions(staff, t.assigned_to).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
