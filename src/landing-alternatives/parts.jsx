// Content shared by the landing alternatives: navbar, hero text, quick search, feature cards,
// key numbers, FAQ and footer. Each option only arranges these pieces differently.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Icon from '../shared/Icon.jsx';
import Logo from '../shared/Logo.jsx';
import ZoneSelect from '../shared/ZoneSelect.jsx';
import { useStaff } from '../shared/staff.jsx';
import { hubSummary } from '../modules/advisories/api.js';
import { advisoriesUrl } from '../modules/advisories/AdvisoriesPage.jsx';
import './landing.css';

const FONT = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

const loadFont = (id, href) => {
  if (document.getElementById(id)) return;
  document.head.appendChild(Object.assign(document.createElement('link'), { id, rel: 'stylesheet', href }));
};

// Loads the landing font (plus an extra one, for option D) once and starts each landing page at the top.
export function useLandingPage(title, extraFont) {
  useEffect(() => {
    loadFont('lp-font', FONT);
    if (extraFont) loadFont(`lp-font-${title.replace(/\W+/g, '-').toLowerCase()}`, extraFont);
    window.scrollTo(0, 0);
    const old = document.title;
    document.title = `${title} · MutiaraInfo`;
    return () => { document.title = old; };
  }, [title, extraFont]);
}

// True while the visitor's system asks for less motion. Follows changes made while the page is open.
export function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = (e) => setReduced(e.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return reduced;
}

// Today's numbers from the database (the same summary the current home page uses).
export function useHub() {
  const [hub, setHub] = useState({ s: null, failed: false });
  useEffect(() => {
    let live = true;
    hubSummary().then((s) => { if (live) setHub({ s, failed: false }); },
      (e) => { console.error(e); if (live) setHub({ s: null, failed: true }); });
    return () => { live = false; };
  }, []);
  return hub;
}

export const Arrow = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

// logo: true shows the site logo (the circled M) instead of the older train badge.
export const Brand = ({ logo }) => logo ? (
  <Link className="lp-brand" to="/landing" aria-label="MutiaraInfo, landing alternatives"><Logo /></Link>
) : (
  <Link className="lp-brand" to="/landing" aria-label="MutiaraInfo, landing alternatives">
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <defs><linearGradient id="lp-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#38BDF8" /><stop offset="1" stopColor="#14B8A6" /></linearGradient></defs>
      <rect width="40" height="40" rx="12" fill="url(#lp-logo)" />
      <rect x="11" y="9" width="18" height="18" rx="6" fill="#fff" />
      <rect x="14" y="12" width="12" height="6" rx="2" fill="#0369A1" />
      <circle cx="15.5" cy="22.5" r="1.6" fill="#0369A1" /><circle cx="24.5" cy="22.5" r="1.6" fill="#0369A1" />
      <path d="M15 30l-2 3M25 30l2 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
    MutiaraInfo
  </Link>
);

const LINKS = [['/advisories', 'Updates'], ['/map', 'Map'], ['/report', 'Report'], ['/track', 'Track Ticket']];

export function LandingNav({ logo }) {
  const navigate = useNavigate();
  const { staff } = useStaff();
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const faq = () => { setOpen(false); document.getElementById('lp-faq')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); };
  const signIn = () => navigate(staff ? '/admin' : '/login');

  return (
    <header className="lp-nav">
      <div className="lp-wrap">
        <Brand logo={logo} />
        <nav className="lp-links" aria-label="Main">
          {LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
          <button type="button" onClick={faq}>FAQ</button>
        </nav>
        <button type="button" className="lp-btn lp-btn-outline lp-staff" onClick={signIn}>Staff Sign in</button>
        <button type="button" className="lp-menu-btn" aria-expanded={open} aria-controls="lp-menu" aria-label="Menu" onClick={() => setOpen(!open)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <div className="lp-menu" id="lp-menu" hidden={!open}>
          {LINKS.map(([to, label]) => <Link key={to} to={to} onClick={() => setOpen(false)}>{label}</Link>)}
          <button type="button" onClick={faq}>FAQ</button>
          <button type="button" className="lp-btn lp-btn-outline" onClick={signIn}>Staff Sign in</button>
        </div>
      </div>
    </header>
  );
}

export function HeroCopy() {
  return (
    <>
      <p className="lp-eyebrow"><span className="lp-dot" aria-hidden="true" />LRT Mutiara Line · Penang</p>
      <h1 className="lp-h1">Stay informed.<br /><span className="lp-grad">Stay moving.</span></h1>
      <p className="lp-lead">Road closures, works schedules and detours along the Mutiara Line, with a simple way to report a problem and follow it up.</p>
      <div className="lp-ctas">
        <Link className="lp-btn lp-btn-primary lp-btn-lg" to="/advisories">View Updates <Arrow /></Link>
        <Link className="lp-btn lp-btn-secondary lp-btn-lg" to="/report">Report an Issue</Link>
      </div>
    </>
  );
}

export function QuickSearch({ className = '' }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('');
  const submit = (e) => { e.preventDefault(); navigate(advisoriesUrl({ q, zone })); };
  return (
    <form className={`lp-search ${className}`} role="search" onSubmit={submit}>
      <div className="lp-field">
        <Icon name="search" size={20} />
        <label htmlFor="lp-q" className="lp-vh">Search updates</label>
        <input id="lp-q" className="lp-input" type="search" placeholder="Search roads, stations or notices" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <label htmlFor="lp-z" className="lp-vh">Zone</label>
      <ZoneSelect id="lp-z" className="lp-input" all="All zones" value={zone} onChange={setZone} />
      <button className="lp-btn lp-btn-primary" type="submit">Search</button>
    </form>
  );
}

// The three feature cards. Use bare in a grid that already wraps them (option C).
export function FeatureCards({ hub, bare = false }) {
  const { s, failed } = hub;
  const cards = [
    { to: '/advisories', icon: 'list', title: 'Construction Updates', text: 'Closures, schedules and business access notices from the project teams.',
      badge: s ? `${s.active} ongoing` : failed ? 'Live list' : 'Loading…', tint: 'var(--lp-tint-sky)', tone: 'var(--lp-sky)', go: 'Browse updates' },
    { to: '/report', icon: 'report', title: 'Report an Issue', text: 'Noise, dust, damage or blocked access? Send it in and get a ticket number.',
      badge: '6 issue types', tint: 'var(--lp-tint-peach)', tone: '#B45309', go: 'Report a concern' },
    { to: '/track', icon: 'Progress', title: 'Track Your Ticket', text: 'Enter your ticket number to see its status and full history.',
      badge: '4 status steps', tint: 'var(--lp-tint-teal)', tone: 'var(--lp-teal)', go: 'Check a ticket' },
  ];
  const list = cards.map((c) => (
    <Link key={c.to} to={c.to} className="lp-feature" style={{ '--tint': c.tint, '--tone': c.tone }}>
      <span className="lp-feature-top">
        <span className="lp-icon-tile"><Icon name={c.icon} size={28} /></span>
        <span className="lp-badge">{c.badge}</span>
      </span>
      <h3>{c.title}</h3>
      <p>{c.text}</p>
      <span className="lp-go">{c.go} <Arrow size={16} /></span>
    </Link>
  ));
  return bare ? list : <div className="lp-features">{list}</div>;
}

export function KeyNumbers({ hub, className = 'lp-stats' }) {
  const { s } = hub;
  const items = [
    { k: 'closures', label: 'Active road closures', to: advisoriesUrl({ category: 'Road closure', status: 'Ongoing' }), tone: 'var(--lp-sky)' },
    { k: 'urgent', label: 'Urgent alerts', to: advisoriesUrl({ urgent: true }), tone: '#C2410C' },
    { k: 'thisWeek', label: 'Works this week', to: '/schedule', tone: 'var(--lp-teal)' },
  ];
  return (
    <div className={className} aria-label="Today at a glance">
      {items.map((i) => (
        <Link key={i.k} to={i.to} className="lp-stat" style={{ '--tone': i.tone }}>
          <b>{s ? s[i.k] : '–'}</b><span>{i.label}</span>
        </Link>
      ))}
    </div>
  );
}

const FAQ = [
  ['How do I find out which roads are closed?', 'Open Updates and choose the type "Road closure", or open the Map and select a red marker to see the dates and detour.'],
  ['How do I report a problem?', 'Go to Report, pick a category, describe the issue and submit. You get a ticket number straight away.'],
  ['How do I check on my ticket?', 'Open Track Ticket and enter your ticket number to see its status and history.'],
  ['Will my shop stay reachable?', 'Business access updates list temporary entrances and delivery hours during the works.'],
];

export function Faq({ heading = true }) {
  return (
    <div className="lp-faq" id="lp-faq">
      {heading && <h2 className="lp-h2">Frequently asked questions</h2>}
      {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </div>
  );
}

export function LandingFooter({ logo }) {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap">
        <Brand logo={logo} />
        <nav className="lp-foot-links" aria-label="Footer">
          {LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
        </nav>
        <small>© 2026 MutiaraInfo · CMT322 project. Roads, zones and dates are sample data.</small>
      </div>
    </footer>
  );
}
