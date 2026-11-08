// Urgent alert banner (UC05): every high-severity advisory scrolls across the top of every page, right to left.
// Selecting one opens it. The ticker pauses on hover, on keyboard focus and with its pause button, and stands
// still for visitors who ask their system for reduced motion. Hiding it lasts for this browser tab, until the
// urgent advisories change.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import Icon from '../../shared/Icon.jsx';
import { dateRange, todayISO } from '../../shared/util.js';
import { listUrgent } from './api.js';

const KEY = 'urgentHidden';
const SPEED = 60; // pixels per second

// Works already under way come first, then the ones starting soonest.
function order(list) {
  const today = todayISO();
  const start = (a) => (!a.starts_on || a.starts_on <= today ? '' : a.starts_on);
  return [...list].sort((a, b) => start(a).localeCompare(start(b)));
}

// One pass of the ticker. The second copy only fills the gap while the first scrolls out, so it is hidden
// from screen readers and the keyboard.
const Items = ({ list, copy, listRef }) => (
  <ul className="ubar-items" ref={listRef} aria-hidden={copy || undefined}>
    {list.map((a) => (
      <li key={a.id}>
        <Link to={`/advisories/${a.id}`} tabIndex={copy ? -1 : undefined}>
          <b>{a.title}</b> <span className="ubar-when">({dateRange(a.starts_on, a.ends_on)})</span>
        </Link>
      </li>
    ))}
  </ul>
);

export default function UrgentBanner() {
  const [list, setList] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [size, setSize] = useState({ view: 0, list: 0 });
  const viewRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    listUrgent().then((l) => setList(order(l)), (e) => console.error(e));
  }, []);

  const key = list.map((a) => `${a.id}:${a.updated_at}`).join(',');
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(KEY) === key; } catch { /* storage blocked: always show */ }
  const show = list.length > 0 && !hidden && !dismissed;

  // Each pass is at least as wide as the visible strip, so even one short alert loops without a jump.
  // The speed stays the same however many alerts there are.
  useEffect(() => {
    const view = viewRef.current, items = listRef.current;
    if (!show || !view || !items) return undefined;
    const measure = () => setSize({ view: view.clientWidth, list: items.offsetWidth });
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    ro.observe(items);
    return () => ro.disconnect();
  }, [show, key]);

  if (!show) return null;

  const hide = () => {
    setHidden(true);
    try { sessionStorage.setItem(KEY, key); } catch { /* private mode: just hide */ }
  };
  const seconds = Math.max(10, size.list / SPEED);
  const label = `urgent alert${list.length > 1 ? 's' : ''}`;

  return (
    <div className="ubar" role="region" aria-label="Urgent alerts">
      <div className="w">
        <span className="ubar-tag"><Icon name="alert" size={22} /><b>Urgent</b></span>
        {/* Keyboard focus stops the ticker and shows the list from the start; leaving it resets the scroll. */}
        <div className="ubar-view" ref={viewRef} onBlur={() => { viewRef.current.scrollLeft = 0; }}
          style={{ '--vw': `${size.view}px`, '--dur': `${seconds}s` }}>
          <div className={`ubar-track${paused ? ' paused' : ''}`}>
            <Items list={list} listRef={listRef} />
            <Items list={list} copy />
          </div>
        </div>
        <button type="button" className="ubar-x ubar-play" aria-label={paused ? `Play the ${label}` : `Pause the ${label}`}
          onClick={() => setPaused(!paused)}><Icon name={paused ? 'play' : 'pause'} size={18} /></button>
        <button type="button" className="ubar-x" aria-label={`Hide the ${label}`} onClick={hide}><Icon name="close" size={18} /></button>
      </div>
    </div>
  );
}
