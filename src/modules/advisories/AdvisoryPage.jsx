// Advisory detail page (UC02): photos, details, key facts and links to report or see the map.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import Icon from '../../shared/Icon.jsx';
import { dateRange, ago } from '../../shared/util.js';
import { reportUrl } from '../complaints/ReportPage.jsx';
import { getAdvisory, photoUrl } from './api.js';
import { where } from './AdvisoryCard.jsx';

// Plain text from the database, with its line breaks kept.
const Para = ({ text }) => text.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>);

const Fact = ({ label, value }) => (value ? <><dt>{label}</dt><dd>{value}</dd></> : null);

function Gallery({ a }) {
  const photos = a.photo_paths || [];
  const [i, setI] = useState(0);
  if (!photos.length) return null;
  return (
    <div className="gal">
      <img className="gal-main" src={photoUrl(photos[i])} alt={`${a.title}, photo ${i + 1} of ${photos.length}`} />
      {photos.length > 1 && (
        <div className="gal-thumbs">
          {photos.map((p, n) => (
            <button type="button" key={p} aria-label={`Show photo ${n + 1}`} aria-pressed={n === i} onClick={() => setI(n)}>
              <img src={photoUrl(p)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Advisory({ a }) {
  const navigate = useNavigate();
  const ended = a.state === 'Ended';
  const pill = ended ? 'dn' : a.status === 'Ongoing' ? 'on' : '';
  return (
    <>
      <div className="adv-head">
        <p>
          {a.severity === 'High' && !ended && <><span className="pill hot">Urgent</span> </>}
          <span className={`pill ${pill}`}>{ended ? 'Ended' : a.status}</span> <span className="pill">{a.category}</span>
        </p>
        <h1>{a.title}</h1>
        <p className="mut adv-sub"><Icon name="pin" size={16} /> {where(a)} <span aria-hidden="true">·</span> Updated <time dateTime={a.updated_at}>{ago(a.updated_at)}</time></p>
      </div>
      <div className="adv">
        <div className="stack">
          <Gallery a={a} key={a.id} />
          <div className="card"><h2>About these works</h2><p>{a.body ? <Para text={a.body} /> : <span className="mut">No further details yet.</span>}</p></div>
          {a.detour && <div className="card"><h2>Detour and access</h2><p><Para text={a.detour} /></p></div>}
          {a.affected_businesses && <div className="card"><h2>Affected businesses</h2><p><Para text={a.affected_businesses} /></p></div>}
        </div>
        <aside className="stack">
          <div className="card"><h2>Key facts</h2><dl className="facts">
            <Fact label="Dates" value={dateRange(a.starts_on, a.ends_on)} />
            <Fact label="Work hours" value={a.work_hours || 'To be confirmed'} />
            <Fact label="Area" value={a.zones ? a.zones.name : 'All areas'} />
            <Fact label="Location" value={a.location} />
            <Fact label="Severity" value={a.severity} />
            <Fact label="Last updated" value={new Date(a.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} />
          </dl></div>
          <div className="card stack">
            <h2>Something wrong near these works?</h2>
            <p className="mut">Tell the team about noise, dust, damage or blocked access and get a ticket number.</p>
            <button type="button" className="btn" onClick={() => navigate(reportUrl(a.location || a.title))}>Report an issue here</button>
            <button type="button" className="btn s" onClick={() => navigate('/map')}>Open the disruption map</button>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function AdvisoryPage() {
  const { id } = useParams();
  const [a, setA] = useState(undefined); // undefined while loading, null when not available

  useEffect(() => {
    let live = true; // another advisory may be opened before this one arrives
    setA(undefined);
    getAdvisory(id).then((x) => { if (live) setA(x); }, (e) => { console.error(e); if (live) setA(null); });
    return () => { live = false; };
  }, [id]);

  return (
    <section>
      <Link className="back" to="/advisories"><Icon name="back" size={18} />All advisories</Link>
      <div aria-live="polite">
        {a === undefined ? <p className="mut" style={{ padding: '40px 0' }}>Loading advisory…</p>
          : a ? <Advisory a={a} />
          : <div className="card" style={{ margin: '20px 0 28px' }}><h2>This advisory is not available</h2><p className="mut">It may have been removed, or the connection failed. Please go back to the list and try again.</p></div>}
      </div>
    </section>
  );
}
