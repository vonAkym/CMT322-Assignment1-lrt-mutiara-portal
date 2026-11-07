// Feedback page: looks up a ticket number in the database and shows its progress.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { STAT, when } from '../../shared/util.js';
import { trackTicket } from './api.js';

// Address of this page that looks up a ticket straight away, e.g. after submitting a report.
export const trackUrl = (ticketNo) => `/track?ticket=${encodeURIComponent(ticketNo)}`;

export default function TrackPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('ticket') || '');
  const [t, setT] = useState(null);
  const [err, setErr] = useState('');

  const seq = useRef(0); // only the newest lookup is shown
  const lookup = async (no) => {
    const my = ++seq.current, s = no.trim();
    let found = null, msg = 'No ticket found with that number.';
    if (s) { try { found = await trackTicket(s); } catch (e) { console.error(e); msg = 'Could not check the ticket. Please try again later.'; } }
    if (my !== seq.current) return;
    setT(found);
    setErr(found ? '' : msg);
  };

  // A ticket number in the address is looked up as soon as the page opens, or when it changes.
  useEffect(() => {
    const no = params.get('ticket');
    if (no) { setQ(no); lookup(no); }
  }, [params]);

  // A new number goes into the address (which looks it up above); the same number again is looked up directly.
  const check = () => {
    const s = q.trim();
    if (s && s !== params.get('ticket')) setParams({ ticket: s }, { replace: true });
    else lookup(s);
  };
  const i = t ? STAT.indexOf(t.status) : -1;

  return (
    <section>
      <h1>Feedback and ticket tracking</h1>
      <div className="row r3">
        <div className="card stack">
          <div><label htmlFor="tq">Ticket number</label>
            <input id="tq" className="in" placeholder="LRT-2026-0001" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') check(); }} /></div>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={check}>Check status</button>
          {err && <p className="err">{err}</p>}
        </div>
        {t && (
          <div className="card" aria-live="polite">
            <h2>{t.ticket_no}</h2>
            <p className="mut">{t.category} · {t.location || 'Not given'}<br />Assigned to: {t.assigned_to || 'Unassigned'}</p>
            <div style={{ margin: '12px 0' }}>
              {STAT.map((s, k) => (
                <div className={`step${k <= i ? ' d' : ''}`} key={s}><i /><span style={k === i ? { fontWeight: 600 } : undefined}>{s}</span></div>
              ))}
            </div>
            <h3>History</h3>
            <p className="mut">{t.history.map((h, k) => <span key={k}>{k > 0 && <br />}{h.status} · {when(h.at)}</span>)}</p>
          </div>
        )}
      </div>
    </section>
  );
}
