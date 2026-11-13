// Manage advisories (UC06 to UC08), staff only: the list of advisories by state, with buttons to view, edit,
// publish and end them. New advisory and Edit open the form on its own page (AdvisoryFormPage.jsx), which comes
// back here after saving with a message saying what was saved.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { dateRange, ago, day } from '../../shared/util.js';
import { useStaff } from '../../shared/staff.jsx';
import { listMyAdvisories, publishAdvisory, endAdvisory, isOverdue, isOver, isUrgent, urgentFrom } from './api.js';
import PageHero from '../../shared/PageHero.jsx';
import usePageTitle from '../../shared/usePageTitle.js';

const STATES = [['Draft', 'Drafts'], ['Published', 'Published'], ['Ended', 'Ended']];

function Actions({ a, busy, onAct }) {
  const b = (act, label, cls = 's') => (
    <button type="button" className={`btn ${cls} sm`} disabled={busy} aria-label={`${label}: ${a.title}`} onClick={() => onAct(act, a)}>{label}</button>
  );
  if (a.state === 'Draft') return <>{b('edit', 'Edit')}{b('publish', 'Publish', '')}</>;
  if (a.state === 'Published') return <>{b('view', 'View')}{b('edit', 'Edit')}{b('end', 'End', 'warn')}</>;
  return b('view', 'View');
}

export default function ManagePage() {
  const navigate = useNavigate();
  const { pathname, state: back } = useLocation(); // back: { ok, tab } after the form saved something
  usePageTitle('Manage advisories');
  const [all, setAll] = useState([]);
  const [tab, setTab] = useState((back && back.tab) || 'Published');
  const [okMsg, setOkMsg] = useState((back && back.ok) || '');
  const [listErr, setListErr] = useState('');
  const [busyRow, setBusyRow] = useState(null);
  // Admins see and manage every advisory (UC07, UC08); other staff see the ones they posted.
  const { user, profile } = useStaff();
  const isAdmin = !!profile && profile.role === 'admin';
  const postedBy = (a) => (a.created_by && user && a.created_by === user.id ? 'You' : a.posted_by || 'Not recorded');

  // The saved message shows once; a refresh or Back does not bring it back.
  useEffect(() => { if (back) navigate(pathname, { replace: true, state: null }); }, []);

  const load = async () => {
    setListErr('');
    try { setAll(await listMyAdvisories({ all: isAdmin })); } catch (e) {
      console.error(e); setAll([]);
      setListErr('Could not load advisories. Please try again later.');
    }
  };
  useEffect(() => { load(); }, [isAdmin]);

  // ---------- Row buttons: view, edit, publish, end (UC08) ----------
  const onAct = async (act, a) => {
    if (act === 'view') { navigate(`/advisories/${a.id}`); return; }
    if (act === 'edit') { navigate(`/manage/${a.id}/edit`); return; }
    if (act === 'end' && !window.confirm(`End "${a.title}"?\n\nUse this when the work has finished. The advisory moves to the ended archive and shows as completed.`)) return;
    setBusyRow(a.id); setOkMsg(''); setListErr('');
    try {
      if (act === 'publish') { await publishAdvisory(a.id); setTab('Published'); } else { await endAdvisory(a.id); setTab('Ended'); }
      await load();
      setOkMsg(`${act === 'publish' ? 'Published' : 'Ended'}: ${a.title}`);
    } catch (err) {
      console.error(err);
      setListErr(`Could not ${act} the advisory. ${err.message}`);
    } finally {
      setBusyRow(null);
    }
  };

  const rows = all.filter((a) => a.state === tab);
  // Published advisories past their end date: the public already sees them as ended, but staff should confirm.
  const overdue = all.filter(isOverdue).length;

  return (
    <section>
      <PageHero kicker="Staff" photo="advisory-viaduct.jpg" title="Manage advisories" sub="Post, edit, publish and end construction advisories.">
        <div className="ctas" style={{ justifyContent: 'flex-start' }}><Link className="btn gold" to="/manage/new">+ New advisory</Link></div>
      </PageHero>
      {isAdmin && <p className="note"><b>Admin view.</b> You see every advisory, including ones posted by other staff and sample ones with no author recorded, and you can edit or end any of them.</p>}

      <div className="tabs" role="group" aria-label="Show advisories by state">
        {STATES.map(([state, label]) => (
          <button type="button" key={state} aria-pressed={tab === state} onClick={() => { setTab(state); setOkMsg(''); }}>
            {label} <span>{all.filter((a) => a.state === state).length}</span>
          </button>
        ))}
      </div>
      {tab === 'Published' && overdue > 0 && (
        <p className="note"><b>{overdue} published advisor{overdue === 1 ? 'y has' : 'ies have'} passed the end date.</b> The public
          already sees {overdue === 1 ? 'it' : 'them'} as ended. Press End if the work has finished, or Edit to move the end date if it is running late.</p>
      )}
      {okMsg && <p className="ok" role="status">{okMsg}</p>}
      {listErr && <p className="err" role="alert">{listErr}</p>}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Advisory</th><th>Type</th><th>Area</th><th>Dates</th>{isAdmin && <th>Posted by</th>}<th>Updated</th><th><span className="vh">Actions</span></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><b>{a.title}</b>{isUrgent(a) && <> <span className="pill hot">Urgent</span></>}
                  {a.severity === 'High' && !isOver(a) && !isUrgent(a) && <> <span className="pill">Urgent from {day(urgentFrom(a), false)}</span></>}
                  {isOverdue(a) && <> <span className="pill late">Past end date</span></>}<br />
                  <span className="mut">{a.status}{a.location ? ` · ${a.location}` : ''}{a.lat != null ? ' · On the map' : ''}</span></td>
                <td>{a.category}</td><td>{a.zones ? a.zones.name : 'All areas'}</td>
                <td>{dateRange(a.starts_on, a.ends_on)}</td>{isAdmin && <td>{postedBy(a)}</td>}<td>{ago(a.updated_at)}</td>
                <td className="acts"><div className="acts-in"><Actions a={a} busy={busyRow === a.id} onAct={onAct} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="mut" style={{ padding: 16 }}>No advisories here yet.</p>}
      </div>
      <div style={{ height: 28 }} />
    </section>
  );
}
