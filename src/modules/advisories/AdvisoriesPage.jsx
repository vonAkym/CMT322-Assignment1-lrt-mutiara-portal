// Advisories page (UC03): search and filter the published advisories, or browse the ended archive.
// The filters live in the address (e.g. #/advisories?status=Ongoing), so the home page and the urgent banner
// can open this page with filters already set, and the back button restores them.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import ZoneSelect from '../../shared/ZoneSelect.jsx';
import { CATS } from '../../shared/util.js';
import { listAdvisories } from './api.js';
import AdvisoryCard from './AdvisoryCard.jsx';
import ZoneAlerts from './ZoneAlerts.jsx';

// Builds the address of this page with some filters set, e.g. advisoriesUrl({ status: 'Ongoing', urgent: true }).
// Keys: q, zone, category, status ('Planned', 'Ongoing' or 'ended'), date (YYYY-MM-DD), urgent.
export function advisoriesUrl(f = {}) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v === true ? '1' : v); });
  const s = p.toString();
  return `/advisories${s ? `?${s}` : ''}`;
}

export default function AdvisoriesPage() {
  const [params, setParams] = useSearchParams();
  const f = {
    q: params.get('q') || '', zone: params.get('zone') || '', category: params.get('category') || '',
    status: params.get('status') || '', date: params.get('date') || '', urgent: params.get('urgent') === '1',
  };
  const set = (k, v) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (v) n.set(k, v === true ? '1' : v); else n.delete(k);
    return n;
  }, { replace: true });

  // The keyword box waits until typing stops for 0.3 s before searching.
  const [q, setQ] = useState(f.q);
  useEffect(() => { setQ(f.q); }, [f.q]);
  useEffect(() => {
    if (q === f.q) return undefined;
    const t = setTimeout(() => set('q', q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Each filter change asks the database again. "live" makes sure only the newest answer is drawn.
  const [res, setRes] = useState({ list: null, error: false });
  useEffect(() => {
    let live = true;
    const ended = f.status === 'ended';
    listAdvisories({
      q: f.q, zoneId: f.zone, category: f.category, onDate: f.date,
      status: ended ? '' : f.status, ended, severity: f.urgent ? 'High' : '',
    }).then((list) => { if (live) setRes({ list, error: false }); },
      (e) => { console.error(e); if (live) setRes({ list: [], error: true }); });
    return () => { live = false; };
  }, [f.q, f.zone, f.category, f.status, f.date, f.urgent]);

  const { list, error } = res;
  const ended = f.status === 'ended';
  return (
    <section>
      <h1>Construction advisories</h1>
      <p className="mut">Road closures, works schedules, business access and progress from the project teams.</p>
      <div className="row r1">
        <div className="card stack" style={{ alignSelf: 'start' }}>
          <h2>Filter advisories</h2>
          <div><label htmlFor="fq">Search</label><input id="fq" className="in" type="search" placeholder="Road, place or keyword" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div><label htmlFor="fz">Area</label><ZoneSelect id="fz" all="All areas" value={f.zone} onChange={(v) => set('zone', v)} /></div>
          <div><label htmlFor="fc">Type</label>
            <select id="fc" className="in" value={f.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">All types</option>{CATS.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div><label htmlFor="fs">Status</label>
            <select id="fs" className="in" value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">All current</option><option>Planned</option><option>Ongoing</option><option value="ended">Ended (archive)</option>
            </select></div>
          <div><label htmlFor="fd">Works on this date</label><input id="fd" className="in" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
          <label className="chk"><input type="checkbox" id="fu" checked={f.urgent} onChange={(e) => set('urgent', e.target.checked)} /> Urgent only</label>
          <button type="button" className="btn s" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</button>
          <hr className="sep" />
          <ZoneAlerts />
        </div>
        <div>
          <p className="mut" role="status">{list && !error ? `${list.length} ${ended ? 'ended ' : ''}advisor${list.length === 1 ? 'y' : 'ies'}` : ''}</p>
          <div className="acards">{list && list.map((a) => <AdvisoryCard key={a.id} a={a} />)}</div>
          {error && <p className="mut">Could not load advisories. Please try again later.</p>}
          {list && !error && !list.length && <p className="mut">No advisories match these filters.</p>}
        </div>
      </div>
    </section>
  );
}
