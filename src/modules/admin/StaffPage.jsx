// Manage staff roles (UC12, admins only): every account that has signed up, with its email, name and role.
// An admin gives an account a staff role (Admin, Construction Team, Government Officer) or takes it away
// ("No staff access"), and sets the name shown when tickets are assigned. Admins cannot change their own role.
// The database checks all of this again (list_accounts and set_account in migration 20261113000000_admin_complete.sql).
// Address: #/admin/staff
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageHero from '../../shared/PageHero.jsx';
import { ROLE_NAMES, STAFF_ROLES, useStaff } from '../../shared/staff.jsx';
import usePageTitle from '../../shared/usePageTitle.js';
import { listAccounts, setAccount } from './api.js';
import { actionError, submittedAt } from './tickets.js';

// The choices offered. Residents and business owners have no staff access; both are shown as one choice.
const CHOICES = [...STAFF_ROLES.map((r) => [r, ROLE_NAMES[r]]), ['resident', 'No staff access']];
const roleLabel = (role) => ROLE_NAMES[role] || 'No staff access';

function AccountRow({ a, me, onSaved }) {
  const [role, setRole] = useState(STAFF_ROLES.includes(a.role) ? a.role : 'resident');
  const [name, setName] = useState(a.full_name || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const self = a.id === me;
  const staffNow = STAFF_ROLES.includes(a.role) ? a.role : 'resident';
  const changed = role !== staffNow || name.trim() !== (a.full_name || '');

  const save = async (e) => {
    e.preventDefault();
    if (!changed) return;
    if (STAFF_ROLES.includes(role) && !name.trim()) {
      setMsg({ ok: false, text: 'Staff need a name, so tickets can be assigned to them.' });
      document.getElementById(`n-${a.id}`).focus();
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const saved = await setAccount(a.id, role, name);
      onSaved({ ...a, role: saved.role, full_name: saved.full_name });
      setMsg({ ok: true, text: 'Saved.' });
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: actionError(err, 'save this account') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <label className="vh" htmlFor={`n-${a.id}`}>Name for {a.email}</label>
        <input id={`n-${a.id}`} className="in" value={name} placeholder="Full name" maxLength={80}
          onChange={(e) => { setName(e.target.value); setMsg(null); }} />
      </td>
      <td className="email">{a.email}{self && <span className="pill">You</span>}<br /><span className="mut small">Joined {submittedAt(a.created_at)}</span></td>
      <td>
        <label className="vh" htmlFor={`r-${a.id}`}>Role for {a.email}</label>
        <select id={`r-${a.id}`} className="in" value={role} disabled={self} title={self ? 'You cannot change your own role' : undefined}
          onChange={(e) => { setRole(e.target.value); setMsg(null); }}>
          {CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </td>
      <td>
        <form onSubmit={save}>
          <button className="btn sm" type="submit" disabled={!changed || busy} aria-label={`Save ${a.email}`}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
        {msg && <p className={msg.ok ? 'okt' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </td>
    </tr>
  );
}

export default function StaffPage() {
  usePageTitle('Manage staff roles');
  const { profile, user } = useStaff();
  const admin = profile?.role === 'admin';
  const [accounts, setAccounts] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!admin) return undefined;
    let live = true;
    listAccounts().then((l) => { if (live) setAccounts(l); },
      (e) => { console.error(e); if (live) { setAccounts([]); setErr(actionError(e, 'load the accounts')); } });
    return () => { live = false; };
  }, [admin]);

  const saved = (a) => setAccounts((list) => list.map((x) => (x.id === a.id ? a : x)));
  const staffCount = (accounts || []).filter((a) => STAFF_ROLES.includes(a.role)).length;

  return (
    <section>
      <PageHero kicker="Staff" title="Manage staff roles" sub="Give people a staff role, change it, or take it away. The name is what others see when assigning tickets." />
      <div className="stack" style={{ paddingBottom: 28 }}>
        <p className="tback" style={{ margin: 0 }}><Link to="/admin">← Operational dashboard</Link></p>
        {!admin ? (
          <p className="err" role="alert">Only admins can manage staff roles.</p>
        ) : (
          <>
            <div className="card">
              <h2>How it works</h2>
              <p className="mut">People first sign up in Supabase (Authentication, Add user). They then appear here with no staff access.
                Give them a role and a name, and they can sign in at once. <b>Admin</b>: everything, including this page.
                <b> Construction Team</b> and <b>Government Officer</b>: see every ticket, and change the status of and reply to the tickets given to them.</p>
            </div>
            <p className="mut" role="status">{accounts && !err ? `${accounts.length} account${accounts.length === 1 ? '' : 's'}, ${staffCount} with staff access` : ''}</p>
            {!accounts && <p className="mut">Loading accounts…</p>}
            {err && <p className="err" role="alert">{err}</p>}
            {!!accounts?.length && (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="tickets accounts">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th><span className="vh">Save</span></th></tr></thead>
                  <tbody>{accounts.map((a) => <AccountRow key={a.id} a={a} me={user?.id} onSaved={saved} />)}</tbody>
                </table>
              </div>
            )}
            <p className="mut small">Current roles: {CHOICES.map(([v]) => `${roleLabel(v)} ${(accounts || []).filter((a) => (STAFF_ROLES.includes(a.role) ? a.role : 'resident') === v).length}`).join(' · ')}</p>
          </>
        )}
      </div>
    </section>
  );
}
