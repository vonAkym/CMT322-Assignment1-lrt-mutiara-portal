// Works schedule (UC04): ongoing and upcoming works grouped by area, each on a four-week timeline.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import ZoneSelect from '../../shared/ZoneSelect.jsx';
import { todayISO, addDays, daysBetween, day, dateRange } from '../../shared/util.js';
import { listSchedule } from './api.js';

const SPAN = 28; // days shown on the timeline, starting today
const pct = (days) => `${(days / SPAN) * 100}%`;

function When({ a, today }) {
  if (!a.starts_on || a.starts_on <= today) return <span className="pill on">Under way</span>;
  const n = daysBetween(today, a.starts_on);
  return <span className="pill">{n === 1 ? 'Starts tomorrow' : `Starts in ${n} days`}</span>;
}

// The coloured bar: where the work starts and ends within the next SPAN days.
function Bar({ a, today }) {
  const from = a.starts_on ? Math.max(0, daysBetween(today, a.starts_on)) : 0;
  if (from >= SPAN) return <span className="sch-later">From {day(a.starts_on, false)} →</span>;
  const openEnded = !a.ends_on || daysBetween(today, a.ends_on) >= SPAN;
  const to = openEnded ? SPAN : daysBetween(today, a.ends_on) + 1;
  const cls = `sch-fill${from === 0 ? ' on' : ''}${openEnded ? ' open' : ''}`;
  return <span className={cls} style={{ left: pct(from), width: pct(to - from) }} />;
}

const Scale = ({ today }) => [0, 7, 14, 21].map((n) =>
  <span key={n} style={{ left: pct(n) }}>{n ? day(addDays(today, n), false) : 'Today'}</span>);

export default function SchedulePage() {
  const [zone, setZone] = useState('');
  const [res, setRes] = useState({ list: null, error: false });
  const today = todayISO();

  useEffect(() => {
    let live = true;
    listSchedule({ zoneId: zone }).then((list) => { if (live) setRes({ list, error: false }); },
      (e) => { console.error(e); if (live) setRes({ list: [], error: true }); });
    return () => { live = false; };
  }, [zone]);

  const groups = {};
  (res.list || []).forEach((a) => { const k = a.zones ? a.zones.name : 'All areas'; (groups[k] = groups[k] || []).push(a); });

  return (
    <section>
      <h1>Works schedule</h1>
      <p className="mut">Ongoing and upcoming works by area. Each bar shows when the work runs over the next four weeks.</p>
      <div className="sch-top">
        <div><label htmlFor="schz">Area</label><ZoneSelect id="schz" all="All areas" value={zone} onChange={setZone} /></div>
        <p className="sch-key mut" aria-hidden="true"><span className="sch-sw on" />Under way <span className="sch-sw" />Planned</p>
      </div>
      <div className="stack" aria-live="polite">
        {Object.keys(groups).sort().map((name) => (
          <div className="card sch-group" key={name}>
            <div className="sch-row sch-head">
              <h2>{name} <span className="mut">({groups[name].length})</span></h2>
              <div className="sch-scale" aria-hidden="true"><Scale today={today} /></div>
            </div>
            <ul className="sch-list">
              {groups[name].map((a) => (
                <li className="sch-row" key={a.id}>
                  <div className="sch-info">
                    <p><When a={a} today={today} /> <span className="mut">{a.category}</span></p>
                    <h3><Link className="sch-title" to={`/advisories/${a.id}`}>{a.title}</Link></h3>
                    <p className="mut">{dateRange(a.starts_on, a.ends_on)}{a.work_hours ? ` · ${a.work_hours}` : ''}</p>
                  </div>
                  <div className="sch-track" aria-hidden="true"><Bar a={a} today={today} /></div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {res.error && <p className="mut">Could not load the schedule. Please try again later.</p>}
      {res.list && !res.error && !res.list.length && <p className="mut">No ongoing or upcoming works in this area.</p>}
      <div style={{ height: 28 }} />
    </section>
  );
}
