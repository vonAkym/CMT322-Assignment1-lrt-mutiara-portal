// Urgent alert banner (UC05): shows high-severity advisories at the top of every page.
// Hiding it lasts for this browser tab, until the urgent advisories change.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Icon from '../../shared/Icon.jsx';
import { dateRange } from '../../shared/util.js';
import { listUrgent } from './api.js';
import { advisoriesUrl } from './AdvisoriesPage.jsx';

const KEY = 'urgentHidden';

export default function UrgentBanner() {
  const [list, setList] = useState([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    listUrgent().then(setList, (e) => console.error(e));
  }, []);

  const key = list.map((a) => `${a.id}:${a.updated_at}`).join(',');
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(KEY) === key; } catch { /* storage blocked: always show */ }
  if (!list.length || hidden || dismissed) return null;

  const hide = () => {
    setHidden(true);
    try { sessionStorage.setItem(KEY, key); } catch { /* private mode: just hide */ }
  };
  const a = list[0], more = list.length - 1;
  return (
    <div className="ubar" role="region" aria-label="Urgent alert">
      <div className="w">
        <Icon name="alert" size={22} />
        <p>
          <b>Urgent:</b> {a.title} ({dateRange(a.starts_on, a.ends_on)}).{' '}
          <Link className="ubar-link" to={`/advisories/${a.id}`}>See details</Link>
          {more > 0 && <> or <Link className="ubar-link" to={advisoriesUrl({ urgent: true })}>view {more} more urgent alert{more > 1 ? 's' : ''}</Link></>}
        </p>
        <button type="button" className="ubar-x" aria-label="Hide this alert" onClick={hide}><Icon name="close" size={18} /></button>
      </div>
    </div>
  );
}
