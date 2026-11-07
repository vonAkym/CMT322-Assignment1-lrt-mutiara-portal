// Animated SVG train scene for options A and B. Only transform animations are used, and all of them stop
// when the visitor's system asks for reduced motion (see landing.css).
//   <TiltScene />  option A: layered scene that tilts with the mouse (CSS 3D), train loops along the guideway
//   <StripScene /> option B: wide strip, scenery scrolls slowly while the train runs across
import { useEffect, useRef } from 'react';
import { useReducedMotion } from './parts.jsx';

// ---------- Pieces ----------
// rest is where the cloud stays when animation is off (reduced motion).
const Cloud = ({ y, s, dur, delay, rest }) => (
  <g className="lp-cloud" style={{ '--dur': `${dur}s`, '--rest': `${rest}px`, animationDelay: `${delay}s` }}>
    <g transform={`translate(0 ${y}) scale(${s})`} fill="#FFFFFF">
      <ellipse cx="44" cy="26" rx="44" ry="16" /><ellipse cx="66" cy="16" rx="26" ry="18" /><ellipse cx="30" cy="16" rx="18" ry="13" />
    </g>
  </g>
);

// Far towers and a Komtar-style round tower, in pale blue. k scales the heights.
const TOWERS = [[30, 60, 150], [110, 44, 190], [170, 70, 130], [300, 50, 170], [380, 40, 120], [600, 44, 200], [680, 70, 140], [740, 50, 180]];
const Skyline = ({ ox = 0, base, k = 1 }) => (
  <g transform={`translate(${ox} 0)`}>
    {TOWERS.map(([x, w, h], i) => <rect key={x} x={x} y={base - h * k} width={w} height={h * k} rx="6" fill={i % 2 ? '#E3EEF9' : '#D6E7F7'} />)}
    <rect x="510" y={base - 250 * k} width="54" height={250 * k} rx="27" fill="#CBE1F5" />
    {[0.25, 0.45, 0.65].map((f) => <rect key={f} x="514" y={base - 250 * k * (1 - f)} width="46" height="3" rx="1.5" fill="#FFFFFF" opacity=".7" />)}
  </g>
);

// Pastel Penang shophouses with arched upper windows and a five-foot-way arcade.
const HOUSES = [[10, 84, 110, '#FFD8C2'], [98, 76, 96, '#BAE6FD'], [178, 90, 124, '#FDE68A'], [272, 80, 104, '#A7F3D0'], [356, 72, 92, '#DDD6FE'],
  [432, 88, 118, '#FBCFE8'], [524, 78, 100, '#FFD8C2'], [606, 92, 126, '#BAE6FD'], [702, 86, 108, '#A7F3D0']];
const Shophouse = ({ x, w, h, c, base }) => {
  const top = base - h, win = w * 0.24;
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} rx="4" fill={c} />
      <rect x={x - 3} y={top - 6} width={w + 6} height="10" rx="3" fill="#FFFFFF" opacity=".9" />
      {[0.18, 0.58].map((f) => <rect key={f} x={x + w * f} y={top + 16} width={win} height={Math.min(30, h * 0.28)} rx={win / 2} fill="#FFFFFF" opacity=".85" />)}
      <path d={`M${x + 6} ${base} V${base - 28} a${(w - 12) / 2} 14 0 0 1 ${w - 12} 0 V${base} Z`} fill="#FFFFFF" opacity=".55" />
    </g>
  );
};
const Houses = ({ ox = 0, base, k = 1 }) => (
  <g transform={`translate(${ox} 0)`}>
    {HOUSES.map(([x, w, h, c]) => <Shophouse key={x} x={x} w={w} h={h * k} c={c} base={base} />)}
  </g>
);

const Tree = ({ x, base, r }) => (
  <g>
    <rect x={x - 3} y={base - r - 6} width="6" height={r + 6} rx="3" fill="#D4B48C" />
    <circle cx={x} cy={base - r * 1.6} r={r} fill="#86EFAC" />
    <circle cx={x - r * 0.35} cy={base - r * 1.9} r={r * 0.45} fill="#BBF7D0" />
  </g>
);

// Elevated guideway: a white beam on T-shaped pillars.
const Guideway = ({ x1, x2, y, base, every }) => {
  const pillars = [];
  for (let x = x1 + every / 2; x < x2; x += every) pillars.push(x);
  return (
    <g>
      {pillars.map((x) => (
        <g key={x}>
          <rect x={x - 9} y={y + 24} width="18" height={base - y - 24} fill="#EEF4FA" stroke="#C7D8EA" strokeWidth="1.5" />
          <rect x={x - 28} y={y + 18} width="56" height="12" rx="5" fill="#F8FBFE" stroke="#C7D8EA" strokeWidth="1.5" />
        </g>
      ))}
      <rect x={x1} y={y + 14} width={x2 - x1} height="8" fill="#DCE8F5" />
      <rect x={x1} y={y} width={x2 - x1} height="16" rx="6" fill="#FFFFFF" stroke="#C7D8EA" strokeWidth="1.5" />
    </g>
  );
};

// One rounded train car, 124 x 52, with bogies that sit on the beam 8 units below it.
const Car = ({ x, y, front }) => (
  <g>
    <rect x={x + 12} y={y - 5} width="100" height="8" rx="4" fill="#E0F2FE" stroke="#BFD3E6" />
    <rect x={x} y={y} width="124" height="52" rx={front ? 24 : 16} fill="#FFFFFF" stroke="#BFD3E6" strokeWidth="1.5" />
    {(front ? [14, 44] : [14, 50, 86]).map((o) => (
      <g key={o}>
        <rect x={x + o} y={y + 10} width="24" height="16" rx="5" fill="#335F8A" />
        <rect x={x + o + 3} y={y + 12} width="8" height="3" rx="1.5" fill="#FFFFFF" opacity=".45" />
      </g>
    ))}
    {front && <>
      <path d={`M${x + 78} ${y + 10} h22 q16 0 18 16 h-40 z`} fill="#335F8A" />
      <circle cx={x + 114} cy={y + 33} r="3.5" fill="#FDE68A" />
    </>}
    <rect x={x + 4} y={y + 31} width="116" height="6" rx="3" fill="#14B8A6" />
    <rect x={x + 4} y={y + 39} width="116" height="3" rx="1.5" fill="#38BDF8" />
    <rect x={x + 16} y={y + 52} width="26" height="8" rx="4" fill="#94A3B8" />
    <rect x={x + 82} y={y + 52} width="26" height="8" rx="4" fill="#94A3B8" />
  </g>
);
const Train = ({ x, y }) => (
  <g className="lp-train">
    <rect x={x + 122} y={y + 28} width="10" height="6" rx="2" fill="#CBD5E1" />
    <rect x={x + 252} y={y + 28} width="10" height="6" rx="2" fill="#CBD5E1" />
    <Car x={x} y={y} /><Car x={x + 130} y={y} /><Car x={x + 260} y={y} front />
  </g>
);

// ---------- Option A: tilting scene ----------
// Mouse position over the scene becomes --mx and --my (-1 to 1); each layer moves by its own --depth.
function useTilt(ref, enabled) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || !window.matchMedia('(pointer: fine)').matches) return undefined;
    let raf = 0, nx = 0, ny = 0;
    const apply = () => { raf = 0; el.style.setProperty('--mx', nx.toFixed(3)); el.style.setProperty('--my', ny.toFixed(3)); };
    const move = (e) => {
      const r = el.getBoundingClientRect();
      nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => { nx = 0; ny = 0; if (!raf) raf = requestAnimationFrame(apply); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); el.style.removeProperty('--mx'); el.style.removeProperty('--my'); };
  }, [ref, enabled]);
}

const W = 800, H = 440, BASE = 352, BEAM = 200; // the beam runs just above the shophouse roofs
const Layer = ({ depth, children }) => (
  <div className="lp-layer" style={{ '--depth': `${depth}px` }}>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">{children}</svg>
  </div>
);

export function TiltScene() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useTilt(ref, !reduced);
  return (
    <div className="lp-scene lp-scene-tilt" ref={ref} role="img" aria-label="Illustration: an LRT train gliding along an elevated guideway past Penang shophouses">
      <div className="lp-scene-inner">
        <Layer depth={6}>
          <circle cx="660" cy="86" r="64" fill="#FFF1DC" opacity=".6" /><circle cx="660" cy="86" r="40" fill="#FFE2B8" />
          <Cloud y={52} s={1.2} dur={70} delay={-10} rest={90} /><Cloud y={110} s={0.8} dur={55} delay={-34} rest={330} />
          <Cloud y={70} s={1} dur={80} delay={-58} rest={520} /><Cloud y={30} s={0.7} dur={62} delay={-20} rest={700} />
          <Skyline base={BASE} />
        </Layer>
        <Layer depth={12}><Houses base={BASE} /></Layer>
        <Layer depth={20}>
          <Guideway x1={-40} x2={W + 40} y={BEAM} base={BASE} every={140} />
          <Train x={200} y={BEAM - 60} />
        </Layer>
        <Layer depth={28}>
          <rect x="-40" y={BASE} width={W + 80} height={H - BASE + 40} fill="#E3F4EA" />
          <rect x="-40" y={BASE + 30} width={W + 80} height="34" fill="#F1F5F9" />
          <path d={`M-40 ${BASE + 47} H${W + 40}`} stroke="#FFFFFF" strokeWidth="4" strokeDasharray="22 18" />
          <Tree x={60} base={BASE + 20} r={20} /><Tree x={330} base={BASE + 22} r={16} /><Tree x={520} base={BASE + 20} r={22} /><Tree x={740} base={BASE + 22} r={18} />
        </Layer>
      </div>
    </div>
  );
}

// ---------- Option B: wide strip ----------
const SW = 1600, SH = 260, SBASE = 214, SBEAM = 96;
export function StripScene() {
  return (
    <div className="lp-strip" role="img" aria-label="Illustration: an LRT train running along an elevated track past Penang shophouses">
      <svg viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <Cloud y={20} s={1} dur={90} delay={-12} rest={180} /><Cloud y={52} s={0.8} dur={75} delay={-40} rest={560} />
        <Cloud y={10} s={1.1} dur={110} delay={-70} rest={1050} /><Cloud y={40} s={0.7} dur={85} delay={-25} rest={1380} />
        {/* Each scenery group is 1600 wide and repeats, so scrolling it by 1600 loops without a jump. */}
        <g className="lp-scroll" style={{ '--dur': '160s' }}>
          {[0, 800, 1600, 2400].map((ox) => <Skyline key={ox} ox={ox} base={SBASE} k={0.62} />)}
        </g>
        <g className="lp-scroll" style={{ '--dur': '90s' }}>
          {[0, 800, 1600, 2400].map((ox) => <Houses key={ox} ox={ox} base={SBASE} k={0.8} />)}
          {[0, 800, 1600, 2400].map((ox) => <g key={ox} transform={`translate(${ox} 0)`}><Tree x={150} base={SBASE} r={16} /><Tree x={500} base={SBASE} r={20} /><Tree x={690} base={SBASE} r={14} /></g>)}
        </g>
        <Guideway x1={-40} x2={SW + 40} y={SBEAM} base={SBASE} every={160} />
        <Train x={600} y={SBEAM - 60} />
        <rect x="0" y={SBASE} width={SW} height={SH - SBASE} fill="#E3F4EA" />
        <path d={`M0 ${SBASE + 24} H${SW}`} stroke="#FFFFFF" strokeWidth="4" strokeDasharray="22 18" />
      </svg>
    </div>
  );
}
