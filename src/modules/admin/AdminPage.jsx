// Admin page: still uses sample tickets until staff sign-in is connected (then use listTickets and updateTicket).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { STAT } from '../../shared/util.js';

const STAFF = ['Unassigned', 'Officer A', 'Officer B', 'Construction team'];
const SAMPLE = [
  { id: 'LRT-2026-0001', c: 'Blocked access', d: 'Shop entrance blocked by barriers.', l: 'Sample Road A', p: 'High', a: 'Officer A', h: [['Submitted', '20 Oct 2026'], ['In progress', '20 Oct 2026']] },
  { id: 'LRT-2026-0002', c: 'Noise', d: 'Loud works after 10 pm.', l: 'Komtar', p: 'Medium', a: 'Unassigned', h: [['Submitted', '20 Oct 2026']] },
];
const KEY = 'lrtT';
function loadSample() { try { const a = localStorage.getItem(KEY); if (a) return JSON.parse(a); } catch { /* storage blocked */ } return SAMPLE; }
const st = (t) => t.h[t.h.length - 1][0];

const Select = ({ label, value, options, onChange }) => (
  <select className="in" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => <option key={o}>{o}</option>)}
  </select>
);

export default function AdminPage() {
  const navigate = useNavigate();
  const [T, setT] = useState(loadSample);

  const change = (i, f, value) => {
    const next = T.map((t, k) => (k !== i ? t
      : f === 's' ? { ...t, h: [...t.h, [value, new Date().toLocaleString()]] } : { ...t, [f]: value }));
    setT(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  const n = (s) => T.filter((t) => st(t) === s).length;
  const stats = [['Total', T.length], ...STAT.map((s) => [s, n(s)])];
  const cc = {};
  T.forEach((t) => { cc[t.c] = (cc[t.c] || 0) + 1; });
  const mx = Math.max(1, ...Object.values(cc));

  return (
    <section>
      <h1>Operational dashboard</h1>
      <div className="stack" style={{ paddingBottom: 28 }}>
        <div className="stats">{stats.map(([label, value]) => <div className="card" key={label}><span className="mut">{label}</span><b>{value}</b></div>)}</div>
        <div className="row r3" style={{ padding: 0 }}>
          <div className="card"><h2>Tickets by category</h2>
            {Object.keys(cc).map((k) => <div className="bar" key={k}><span style={{ width: 110 }}>{k}</span><i style={{ width: `${(cc[k] / mx) * 60}%` }} />{cc[k]}</div>)}
          </div>
          <div className="card stack" style={{ alignSelf: 'start' }}>
            <h2>Construction advisories</h2>
            <p className="mut">Advisories are posted, edited and ended on the My advisories page.</p>
            <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/manage')}>Open My advisories</button>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Ticket</th><th>Category</th><th>Issue</th><th>Priority</th><th>Status</th><th>Assigned to</th></tr></thead>
            <tbody>
              {T.map((t, i) => (
                <tr key={t.id}>
                  <td>{t.id}</td><td>{t.c}</td><td>{t.d}<br /><span className="mut">{t.l}</span></td>
                  <td><Select label={`Priority for ${t.id}`} value={t.p} options={['Low', 'Medium', 'High']} onChange={(v) => change(i, 'p', v)} /></td>
                  <td><Select label={`Status for ${t.id}`} value={st(t)} options={STAT} onChange={(v) => change(i, 's', v)} /></td>
                  <td><Select label={`Assignee for ${t.id}`} value={t.a} options={STAFF} onChange={(v) => change(i, 'a', v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
