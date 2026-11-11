// The advisory card used on the home and advisories pages. The whole card opens the advisory.
import { Link } from 'react-router';
import Icon from '../../shared/Icon.jsx';
import { dateRange, ago } from '../../shared/util.js';
import { photoUrl, isOver, isUrgent } from './api.js';

export const where = (a) => a.location || (a.zones && a.zones.name) || 'Location to be confirmed';

export default function AdvisoryCard({ a }) {
  const first = a.photo_paths && a.photo_paths[0];
  const over = isOver(a);
  return (
    <article className="acard">
      <div className="acard-img">
        {first ? <img src={photoUrl(first)} alt="" loading="lazy" /> : <span className="acard-ph"><Icon name={a.category} size={44} /></span>}
        {/* The labels on the photo: urgent first, then where the work stands. */}
        <span className="acard-tags">
          {isUrgent(a) && <span className="tag hot">Urgent</span>}
          <span className="tag">{over ? 'Ended' : a.status}</span>
        </span>
        <span className="tag acard-type">{a.category}</span>
      </div>
      <div className="acard-body">
        <p className="acard-meta"><Icon name="pin" size={15} /><span>{where(a)}</span></p>
        <h3><Link className="acard-link" to={`/advisories/${a.id}`}>{a.title}</Link></h3>
        <p className="mut clamp">{a.body}</p>
        <p className="acard-foot">
          <span><Icon name="calendar" size={15} /> {dateRange(a.starts_on, a.ends_on)}</span>
          <span>Updated {ago(a.updated_at)}</span>
        </p>
      </div>
    </article>
  );
}
