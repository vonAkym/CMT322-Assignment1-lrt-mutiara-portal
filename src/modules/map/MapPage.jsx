// Map page: schematic SVG map with sample markers (not connected to the database yet).
// Drag to move, mouse wheel or buttons to zoom, select a marker for its details.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { reportUrl } from '../complaints/ReportPage.jsx';

// l = layer, n = name, s = status, f/t = first and last sample day, x/y = position, p = line path, d = details.
const M = [
  { l: 'closure', n: 'Sample Road A', s: 'Closed', f: 1, t: 10, x: 300, y: 440, p: 'M300 360V520', d: 'Use the green detour beside it. Pedestrians use the covered walkway.' },
  { l: 'closure', n: 'Sample Road B', s: 'Partly closed', f: 5, t: 14, x: 530, y: 150, p: 'M420 150H650', d: 'One lane stays open. Expect delays.' },
  { l: 'walk', n: 'Covered walkway', s: 'Open', f: 1, t: 14, x: 430, y: 370, p: 'M430 310V390H580', d: 'Pedestrian route beside the works. Wheelchair accessible.' },
  { l: 'biz', n: 'Sample Shop entrance', s: 'Open', f: 1, t: 14, x: 345, y: 400, d: 'Enter from the side street. Delivery access 7 am to 10 am.' },
  { l: 'detour', n: 'Detour for Sample Road A', s: 'Open', f: 1, t: 10, x: 245, y: 470, p: 'M245 345V520', d: 'Light vehicles follow this route while Sample Road A is closed.' },
  { l: 'stn', n: 'Bayan Lepas', s: 'Station', f: 1, t: 14, x: 60, y: 430, d: 'Sample station at the southern end of the line.' },
  { l: 'stn', n: 'Sample Station A', s: 'Station', f: 1, t: 14, x: 180, y: 400, d: 'Sample station. No works nearby.' },
  { l: 'stn', n: 'Sample Station B', s: 'Station', f: 1, t: 14, x: 300, y: 330, d: 'Sample station. Works on Sample Road A are close by.' },
  { l: 'stn', n: 'Komtar', s: 'Station', f: 1, t: 14, x: 420, y: 300, d: 'Sample station in the city centre.' },
  { l: 'stn', n: 'Sample Station C', s: 'Station', f: 1, t: 14, x: 520, y: 230, d: 'Sample station. Sample Road B has partial closures.' },
  { l: 'stn', n: 'Sample Station D', s: 'Station', f: 1, t: 14, x: 650, y: 200, d: 'Sample station. No works nearby.' },
  { l: 'stn', n: 'Penang Sentral', s: 'Station', f: 1, t: 14, x: 800, y: 100, d: 'Sample station at the northern end of the line.' },
];
const COL = { closure: 'var(--red)', walk: 'var(--walk)', detour: 'var(--ok)' };
const BLOCKS = [[30, 40, 160, 90], [330, 30, 150, 90], [680, 30, 170, 80], [30, 160, 190, 120], [330, 170, 170, 100], [690, 230, 170, 120], [330, 420, 70, 90], [420, 420, 170, 90], [660, 400, 200, 110], [40, 460, 150, 50]];
const LINE = '60,430 180,400 300,330 420,300 520,230 650,200 800,100';
const LAYERS = [
  ['stn', 'LRT line and stations', <><path d="M0 9H26" stroke="var(--pri)" strokeWidth="6" /><circle cx="13" cy="9" r="6" fill="var(--sf)" stroke="var(--pri)" strokeWidth="3" /></>],
  ['closure', 'Road closures', <path d="M0 9H26" stroke="var(--red)" strokeWidth="6" />],
  ['walk', 'Pedestrian routes', <path d="M0 9H26" stroke="var(--walk)" strokeWidth="4" strokeDasharray="6 4" />],
  ['detour', 'Detour routes', <path d="M0 9H26" stroke="var(--ok)" strokeWidth="4" strokeDasharray="2 4" strokeLinecap="round" />],
  ['biz', 'Business access', <rect x="4" y="1" width="16" height="16" rx="3" fill="var(--ok)" />],
];
const W = 900, H = 520, FULL = { x: 0, y: 0, w: W, h: H };

// Keeps the visible area inside the map.
const fit = (v) => ({ ...v, x: Math.max(0, Math.min(W - v.w, v.x)), y: Math.max(0, Math.min(H - v.h, v.y)) });

function Marker({ m, last }) {
  const c = COL[m.l];
  return (
    <>
      {m.p && <path d={m.p} fill="none" stroke={c} strokeWidth={m.l === 'closure' ? 9 : 5}
        {...(m.l === 'walk' ? { strokeDasharray: '12 8' } : m.l === 'detour' ? { strokeDasharray: '3 9', strokeLinecap: 'round' } : {})} />}
      {m.l === 'closure' ? <><circle cx={m.x} cy={m.y} r="17" fill={c} /><text x={m.x} y={m.y + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff">X</text></>
        : m.l === 'walk' || m.l === 'detour' ? <><circle cx={m.x} cy={m.y} r="14" fill={c} /><text x={m.x} y={m.y + 6} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--bg)">{m.l === 'walk' ? 'P' : 'D'}</text></>
        : m.l === 'biz' ? <><rect x={m.x - 16} y={m.y - 16} width="32" height="32" rx="6" fill="var(--ok)" /><text x={m.x} y={m.y + 7} textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--bg)">B</text></>
        : <><circle cx={m.x} cy={m.y} r="11" fill="var(--sf)" stroke="var(--pri)" strokeWidth="5" /><text className="tl" x={last ? m.x - 18 : m.x} y={last ? m.y + 6 : m.y - 20} textAnchor={last ? 'end' : 'middle'}>{m.n}</text></>}
    </>
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const svg = useRef(null);
  const drag = useRef(null);
  const [vb, setVb] = useState(FULL);
  const [day, setDay] = useState(1);
  const [q, setQ] = useState('');
  const [on, setOn] = useState(() => new Set(LAYERS.map(([l]) => l)));
  const [picked, setPicked] = useState(null);

  const zoom = (f, cx, cy) => setVb((v) => {
    const w = Math.min(W, Math.max(200, v.w * f)), k = w / v.w;
    const x0 = cx == null ? v.x + v.w / 2 : cx, y0 = cy == null ? v.y + v.h / 2 : cy;
    return fit({ x: x0 - (x0 - v.x) * k, y: y0 - (y0 - v.y) * k, w, h: v.h * k });
  });

  // Mouse wheel zoom (needs a non-passive listener to stop the page scrolling) and drag to move.
  useEffect(() => {
    const el = svg.current;
    const point = (e) => { const p = el.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(el.getScreenCTM().inverse()); };
    const wheel = (e) => { e.preventDefault(); const p = point(e); zoom(e.deltaY > 0 ? 1.15 : 0.87, p.x, p.y); };
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
      if (d.moved) setVb((v) => fit({ ...v, x: d.vx - dx * v.w / el.clientWidth, y: d.vy - dy * v.w / el.clientWidth }));
    };
    const up = () => { el.style.cursor = 'grab'; setTimeout(() => { drag.current = null; }, 0); };
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('wheel', wheel); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  const down = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y, moved: false }; svg.current.style.cursor = 'grabbing'; };

  const pick = (i, fly) => {
    setPicked(i);
    if (fly) { const m = M[i], w = 380, h = 380 * H / W; setVb(fit({ x: m.x - w / 2, y: m.y - h / 2, w, h })); }
  };

  const find = (e) => {
    e.preventDefault();
    const s = q.trim().toLowerCase();
    const i = s ? M.findIndex((m) => m.n.toLowerCase().includes(s)) : -1;
    if (i > -1) { setOn(new Set([...on, M[i].l])); pick(i, true); }
  };

  const toggle = (l) => { const n = new Set(on); if (n.has(l)) n.delete(l); else n.add(l); setOn(n); };
  const query = q.toLowerCase();
  const m = picked == null ? null : M[picked];

  return (
    <section>
      <h1>Construction and disruption map</h1>
      <p className="mut">Schematic map of the LRT Mutiara Line, not to scale. Station names, roads and dates are samples.</p>
      <div className="row r2">
        <div className="card stack" style={{ alignSelf: 'start' }}>
          <form onSubmit={find}>
            <label htmlFor="ms">Search station, street or business</label>
            <input id="ms" className="in" list="mlist" placeholder="e.g. Komtar" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            <datalist id="mlist">{M.map((x) => <option key={x.n} value={x.n} />)}</datalist>
          </form>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Legend and layers</legend>
            {LAYERS.map(([l, label, sw]) => (
              <label className="lg" key={l}><input type="checkbox" checked={on.has(l)} onChange={() => toggle(l)} /><svg width="26" height="18" aria-hidden="true">{sw}</svg>{label}</label>
            ))}
          </fieldset>
          <div><label htmlFor="day">Day <span>{day}</span> of 14 (sample schedule)</label>
            <input id="day" type="range" min="1" max="14" value={day} onChange={(e) => setDay(+e.target.value)} style={{ width: '100%' }} /></div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: 'var(--mapbg)' }}>
          <div className="zc">
            <button type="button" aria-label="Zoom in" onClick={() => zoom(0.7)}>+</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoom(1.4)}>&minus;</button>
            <button type="button" aria-label="Reset view" style={{ fontSize: 14 }} onClick={() => setVb(FULL)}>Reset</button>
          </div>
          <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width="100%" style={{ display: 'block', touchAction: 'none', cursor: 'grab' }}
            role="group" aria-label="Map of the LRT Mutiara Line with construction and disruption markers" onPointerDown={down}>
            {BLOCKS.map(([x, y, w, h]) => <rect key={`${x},${y}`} x={x} y={y} width={w} height={h} rx="6" fill="var(--blk)" />)}
            <g stroke="var(--sf)" strokeLinecap="round" fill="none">
              <path d="M300 0V520" strokeWidth="30" /><path d="M245 330V520" strokeWidth="18" /><path d="M0 150H900" strokeWidth="28" />
              <path d="M0 390H900" strokeWidth="20" /><path d="M650 150V520" strokeWidth="20" />
            </g>
            {on.has('stn') && <>
              <polyline points={LINE} fill="none" stroke="var(--sf)" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={LINE} fill="none" stroke="var(--pri)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
            </>}
            {M.map((x, i) => (
              <g key={x.n} className="mk" tabIndex="0" role="button" aria-label={`${x.n}, ${x.s}`}
                style={{ display: on.has(x.l) && day >= x.f && day <= x.t ? '' : 'none', opacity: query && !x.n.toLowerCase().includes(query) ? 0.25 : 1 }}
                onClick={() => { if (!(drag.current && drag.current.moved)) pick(i); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } }}>
                <Marker m={x} last={i === M.length - 1} />
              </g>
            ))}
          </svg>
        </div>

        <div className="card" style={{ alignSelf: 'start' }} aria-live="polite">
          {m ? <>
            <span className={`pill ${m.s === 'Open' || m.s === 'Station' ? 'dn' : 'on'}`}>{m.s}</span>
            <h3>{m.n}</h3>
            <p className="mut">{m.l !== 'stn' && <>Sample days {m.f} to {m.t}.<br /></>}{m.d}</p>
            <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => navigate(reportUrl(m.n))}>Report an issue here</button>
          </> : <p className="mut">Select a station or marker on the map to see its details. Drag to move the map and use the buttons or mouse wheel to zoom.</p>}
        </div>
      </div>
    </section>
  );
}
