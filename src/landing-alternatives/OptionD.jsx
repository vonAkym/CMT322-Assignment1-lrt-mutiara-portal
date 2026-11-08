// Option D: photo-led, in the style of the Penang Tourism site. Full-screen photo hero with a see-through
// navbar, photo cards for the latest updates, an about split, a photo call-to-action band and the FAQ.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Icon from '../shared/Icon.jsx';
import { photoUrl } from '../modules/advisories/api.js';
import { where } from '../modules/advisories/AdvisoryCard.jsx';
import { LandingNav, QuickSearch, KeyNumbers, Faq, LandingFooter, Arrow, useHub, useLandingPage, useReducedMotion } from './parts.jsx';
import './landing-d.css'; // after parts.jsx, so it loads after landing.css

const OUTFIT = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap';

// True once the page has scrolled past the top, so the navbar can turn solid.
function useScrolled(px = 40) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > px);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > px);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, [px]);
  return scrolled;
}

const Title = ({ kicker, children, id }) => (
  <div className="lp-d-title">
    <p>{kicker}</p>
    <h2 id={id}>{children}</h2>
  </div>
);

// One latest-update card: the photo fills the card and the text sits on a dark fade at the bottom.
function PhotoCard({ a }) {
  const first = a.photo_paths && a.photo_paths[0];
  return (
    <Link to={`/advisories/${a.id}`} className="lp-d-card">
      {first
        ? <img src={photoUrl(first)} alt="" loading="lazy" />
        : <span className="lp-d-card-ph" aria-hidden="true"><Icon name={a.category} size={56} /></span>}
      <span className="lp-d-card-text">
        <span className="lp-d-chip">{a.severity === 'High' ? `Urgent · ${a.category}` : a.category}</span>
        <b>{a.title}</b>
        <span className="lp-d-card-where"><Icon name="pin" size={15} />{where(a)}</span>
      </span>
    </Link>
  );
}

function Latest({ hub }) {
  const { s, failed } = hub;
  if (failed) return <p className="lp-d-note">The latest updates could not be loaded. <Link to="/advisories">Open the full list</Link>.</p>;
  if (!s) return <div className="lp-d-cards" aria-busy="true">{[0, 1, 2].map((i) => <span key={i} className="lp-d-card lp-d-skel" />)}</div>;
  if (!s.latest.length) return <p className="lp-d-note">No works are published right now.</p>;
  return <div className="lp-d-cards">{s.latest.map((a) => <PhotoCard key={a.id} a={a} />)}</div>;
}

export default function OptionD() {
  useLandingPage('Option D', OUTFIT);
  const hub = useHub();
  const scrolled = useScrolled();
  const reduced = useReducedMotion();
  const toLatest = () => document.getElementById('lp-d-latest')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });

  return (
    <div className={`lp lp-d${scrolled ? ' is-solid' : ''}`}>
      <LandingNav logo />

      <section className="lp-d-hero" aria-labelledby="lp-d-h1">
        <div className="lp-d-hero-bg" aria-hidden="true" />
        <div className="lp-wrap lp-d-hero-in">
          <p className="lp-d-kicker">LRT Mutiara Line · Penang</p>
          <h1 id="lp-d-h1">Know the works before you&nbsp;go</h1>
          <p className="lp-d-sub">Road closures, detours and works hours along the Mutiara Line, plus a simple way to report a problem near the works and follow it up.</p>
          <div className="lp-d-ctas">
            <Link className="lp-d-pill lp-d-pill-gold" to="/advisories">View updates <Arrow /></Link>
            <Link className="lp-d-pill lp-d-pill-ghost" to="/report">Report an issue</Link>
          </div>
          <QuickSearch className="lp-d-search" />
        </div>
        <button type="button" className="lp-d-cue" onClick={toLatest}>
          See what’s happening
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </section>

      <main>
        <section className="lp-wrap lp-d-section" id="lp-d-latest" aria-labelledby="lp-d-latest-h">
          <Title kicker="Latest updates" id="lp-d-latest-h">What’s happening on the line</Title>
          <Latest hub={hub} />
          <div className="lp-d-more"><Link className="lp-d-pill lp-d-pill-dark" to="/advisories">See all updates <Arrow /></Link></div>
        </section>

        <section className="lp-wrap lp-d-section lp-d-about" aria-labelledby="lp-d-about-h">
          <div className="lp-d-about-img">
            <img src="assets/img/advisory-viaduct.jpg" alt="Viaduct columns of the Mutiara Line under construction beside houses in George Town" loading="lazy" />
            <span className="lp-d-float"><Icon name="Schedule" size={20} />Works updated by the project teams</span>
          </div>
          <div className="lp-d-about-text">
            <Title kicker="About this portal" id="lp-d-about-h">One place for every works notice</Title>
            <p>MutiaraInfo gathers the notices for the Mutiara Line works: which roads are closed, when the noisy work happens, and how to reach shops near the sites. Today along the line:</p>
            <KeyNumbers hub={hub} className="lp-d-stats" />
            <Link className="lp-d-pill lp-d-pill-dark" to="/map">Open the map <Arrow /></Link>
          </div>
        </section>

        <section className="lp-d-band" aria-labelledby="lp-d-band-h">
          <div className="lp-wrap">
            <div className="lp-d-band-in">
              <h2 id="lp-d-band-h">Noise, dust or a blocked entrance?</h2>
              <p>Tell us what is wrong and where. You get a ticket number straight away, and you can check its progress at any time.</p>
              <div className="lp-d-ctas">
                <Link className="lp-d-pill lp-d-pill-gold" to="/report">Report an issue <Arrow /></Link>
                <Link className="lp-d-pill lp-d-pill-ghost" to="/track">Track a ticket</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-d-section lp-d-faq" aria-labelledby="lp-d-faq-h">
          <div>
            <Title kicker="Questions" id="lp-d-faq-h">Good to know</Title>
            <p className="lp-d-muted">Short answers to what people ask most about the works and this portal.</p>
          </div>
          <Faq heading={false} />
        </section>
      </main>

      <LandingFooter logo />
    </div>
  );
}
