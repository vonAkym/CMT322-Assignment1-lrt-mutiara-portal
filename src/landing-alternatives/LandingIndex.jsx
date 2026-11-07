// Preview page for the three landing alternatives: one card per option, plus a link to the current home page.
import { Link } from 'react-router';
import { Arrow, Brand, useLandingPage } from './parts.jsx';

// Tiny wireframes of each layout. Each block is [class, left%, top%, width%, height%].
const MOCKS = {
  a: [['t', 6, 22, 30, 0], ['t', 6, 34, 22, 0], ['o', 6, 52, 14, 0], ['', 22, 50, 14, 7], ['s', 52, 14, 42, 58], ['', 6, 78, 88, 10]],
  b: [['t', 30, 14, 40, 0], ['t', 36, 26, 28, 0], ['o', 38, 40, 11, 0], ['', 51, 38, 11, 7], ['g', 0, 56, 100, 22], ['', 16, 72, 68, 10]],
  c: [['', 6, 10, 42, 46], ['s', 52, 10, 42, 46], ['', 6, 60, 88, 9], ['g', 6, 73, 20, 18], ['', 29, 73, 20, 18], ['s', 52, 73, 20, 18], ['', 75, 73, 19, 18]],
};

const OPTIONS = [
  { id: 'a', name: 'Option A: Split hero', text: 'Headline and buttons on the left, a layered 3D train scene on the right that tilts with the mouse.' },
  { id: 'b', name: 'Option B: Centred hero', text: 'Centred headline, with the train gliding along an elevated track across the bottom of the hero.' },
  { id: 'c', name: 'Option C: Bento grid', text: 'Everything in rounded tiles. The 3D train is a large Three.js tile that slowly turns.' },
];

export default function LandingIndex() {
  useLandingPage('Landing alternatives');
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap">
          <Brand />
          <Link className="lp-btn lp-btn-outline" to="/" style={{ marginLeft: 'auto' }}>Current home page</Link>
        </div>
      </header>
      <main className="lp-wrap">
        <section className="lp-section" style={{ paddingBottom: 0 }}>
          <h1 className="lp-h1" style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginTop: 0 }}>Landing page alternatives</h1>
          <p className="lp-lead">Three designs for the MutiaraInfo home page, using the same live data and links. Open each one and compare.</p>
        </section>
        <div className="lp-previews">
          {OPTIONS.map((o) => (
            <Link key={o.id} to={`/landing/${o.id}`} className="lp-preview">
              <div className="lp-mock" aria-hidden="true">
                {MOCKS[o.id].map(([cls, l, t, w, h], i) => (
                  <i key={i} className={cls} style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, ...(h ? { height: `${h}%` } : {}) }} />
                ))}
              </div>
              <div className="lp-preview-body">
                <h2>{o.name}</h2>
                <p>{o.text}</p>
                <span className="lp-go" style={{ '--tone': 'var(--lp-sky)' }}>Open option {o.id.toUpperCase()} <Arrow size={16} /></span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
