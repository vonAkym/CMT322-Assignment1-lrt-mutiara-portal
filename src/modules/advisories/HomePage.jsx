// Home page (UC01): today's numbers, the latest advisories, quick links and common questions.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Icon from '../../shared/Icon.jsx';
import ZoneSelect from '../../shared/ZoneSelect.jsx';
import { hubSummary } from './api.js';
import AdvisoryCard from './AdvisoryCard.jsx';
import { advisoriesUrl } from './AdvisoriesPage.jsx';

// What each number on the banner counts, and the page it opens.
const TILES = [
  { key: 'closures', icon: 'Road closure', label: 'Active road closures', to: advisoriesUrl({ category: 'Road closure', status: 'Ongoing' }) },
  { key: 'active', icon: 'list', label: 'Ongoing advisories', to: advisoriesUrl({ status: 'Ongoing' }) },
  { key: 'urgent', icon: 'alert', label: 'Urgent alerts', to: advisoriesUrl({ urgent: true }) },
  { key: 'thisWeek', icon: 'calendar', label: 'Works this week', to: '/schedule' },
];

const CARDS = [
  { to: '/map', icon: 'map', c: 'c2', title: 'Disruption map', text: 'Closed roads, pedestrian routes and shop access shown by location and date.', go: 'Open the map →' },
  { to: '/report', icon: 'report', c: 'c3', title: 'Report a concern', text: 'Tell the team about noise, dust, damage or blocked access and get a ticket number.', go: 'Report a concern →' },
  { to: '/track', icon: 'Progress', c: 'c1', title: 'Track your ticket', text: 'Enter your ticket number to see its status and history.', go: 'Check a ticket →' },
];

const FAQ = [
  ['Where do I see what is happening today?', 'The numbers at the top of this page count today\'s road closures, ongoing works and urgent alerts. Select one to see the advisories behind it.'],
  ['How do I find out which roads are closed?', 'Open Advisories and choose the type "Road closure", or open the Map and select a red marker to see the dates and detour.'],
  ['How do I report a problem?', 'Go to Report, choose a category, describe the issue and submit. You will receive a ticket number.'],
  ['How do I check on my ticket?', 'Open Feedback and enter your ticket number to see its status and history.'],
  ['Will my shop stay reachable?', 'Business access advisories list temporary entrances and delivery hours during the works.'],
];

export default function HomePage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('');

  // Fresh numbers every time the home page opens.
  useEffect(() => {
    let live = true;
    hubSummary().then((s) => { if (live) setSummary(s); }, (e) => { console.error(e); if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  const search = (e) => { e.preventDefault(); navigate(advisoriesUrl({ q, zone })); };

  return (
    <section>
      <div className="hero"><div className="hero-in">
        <p className="kick">LRT Mutiara Line · Penang</p>
        <h1>Know the works before you go</h1>
        <p className="lead">Road closures, pedestrian routes, business access and construction schedules in one place, with a clear way to raise your concerns.</p>
        <div className="ctas">
          <Link className="btn gold" to="/advisories">View advisories</Link>
          <Link className="btn gh" to="/report">Report a concern</Link>
        </div>
        <form className="sf" role="search" onSubmit={search}>
          <span className="sw">
            <Icon name="search" size={20} stroke="#4B5A52" />
            <label htmlFor="hq" className="vh">Search advisories</label>
            <input id="hq" className="in" placeholder="Search advisories, roads or places" value={q} onChange={(e) => setQ(e.target.value)} />
          </span>
          <label htmlFor="hz" className="vh">Area</label>
          <ZoneSelect id="hz" all="All areas" value={zone} onChange={setZone} />
          <button className="btn gold" type="submit">Search</button>
        </form>
        <h2 className="vh">Today at a glance</h2>
        <div className="hstats">
          {TILES.map((t) => (
            <button type="button" className="hstat" key={t.key} onClick={() => navigate(t.to)}>
              <Icon name={t.icon} size={26} /><b>{summary ? summary[t.key] : '–'}</b><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="hero-credit">Photo: <a href="https://commons.wikimedia.org/wiki/File:George_Town,_Penang_city_centre.jpg" target="_blank" rel="noopener">George Town, Penang</a> by HundenvonPenang, CC BY-SA 4.0</p></div>

      <div className="ttl"><p>Latest advisories</p><h2>What’s happening on the line</h2></div>
      <div className="acards three" aria-live="polite">
        {failed ? <p className="mut">Could not load the latest advisories. Please try again later.</p>
          : !summary ? <p className="mut">Loading the latest advisories…</p>
          : summary.latest.length ? summary.latest.map((a) => <AdvisoryCard key={a.id} a={a} />)
          : <p className="mut">There are no advisories at the moment.</p>}
      </div>
      <div className="more"><Link className="btn" to="/advisories">View all advisories</Link></div>

      <div className="ttl"><p>Quick links</p><h2>What would you like to do?</h2></div>
      <div className="hg">
        {CARDS.map((c) => (
          <button className="card hc hc2" key={c.to} onClick={() => navigate(c.to)} style={{ '--cc': `var(--${c.c})`, '--cb': `var(--${c.c}b)` }}>
            <span className="tp"><span className="ic2"><Icon name={c.icon} size={32} stroke={`var(--${c.c})`} width={1.8} /></span></span>
            <h3>{c.title}</h3><p className="mut">{c.text}</p><span className="go">{c.go}</span>
          </button>
        ))}
      </div>

      <div className="band"><div className="band-in"><div>
        <h2>Noise, dust or a blocked entrance?</h2>
        <p>Tell us what is wrong and where. You get a ticket number straight away, and you can check its progress at any time.</p>
        <div className="ctas">
          <Link className="btn gold" to="/report">Report a concern</Link>
          <Link className="btn gh" to="/track">Track a ticket</Link>
        </div>
      </div></div></div>

      <div className="faq2">
        <div className="ttl l"><p>Questions</p><h2>Frequently asked questions</h2></div>
        <div>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </div>
    </section>
  );
}
