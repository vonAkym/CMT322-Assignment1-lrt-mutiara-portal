// The frame around every page: header with the menu, urgent banner, the page itself, and the footer.
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import UrgentBanner from '../modules/advisories/UrgentBanner.jsx';
import { useStaff } from './staff.jsx';
import Logo from './Logo.jsx';

// The public pages. Signed-in staff get the staff pages instead (they can sign out to see the site as the public does;
// the footer and links inside pages still reach the public pages).
const MENU = [['/advisories', 'Advisories'], ['/schedule', 'Schedule'], ['/map', 'Map'], ['/report', 'Report'], ['/track', 'Feedback']];
// [address, label, admins only]. The dashboard link is only marked when on /admin itself, not on Manage staff (/admin/staff).
// Its label is the signed-in person's role (see DASHBOARD).
const STAFF_MENU = [['/admin', ''], ['/map/edit', 'Edit map'], ['/manage', 'Manage advisories'], ['/admin/staff', 'Manage staff', true]];
// The dashboard link says who is signed in: Admin, Construction or Government.
const DASHBOARD = { admin: 'Admin', construction: 'Construction', government: 'Government' };

const Brand = () => <Link className="brand" to="/" aria-label="MutiaraInfo, home"><Logo /></Link>;

export default function Layout() {
  const { staff, profile, signOut } = useStaff();
  const isAdmin = !!profile && profile.role === 'admin';
  const menu = staff ? STAFF_MENU.filter(([, , adminOnly]) => !adminOnly || isAdmin) : MENU;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false); // the menu on small screens

  // Each new page starts at the top, with the small-screen menu closed.
  useEffect(() => { window.scrollTo(0, 0); setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  // Sign in opens the sign-in page; Sign out ends the session and goes home.
  const toggleSignIn = async () => {
    if (!staff) { navigate('/login'); return; }
    try { await signOut(); } catch (e) { console.error(e); }
    navigate('/');
  };

  return (
    <>
      <header className="top"><div className="w">
        <Brand />
        <nav id="site-menu" className={open ? 'open' : ''} aria-label="Main">
          {menu.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'}>{to === '/admin' ? DASHBOARD[profile?.role] || 'Dashboard' : label}</NavLink>
          ))}
        </nav>
        <button type="button" className="btn o sp" onClick={toggleSignIn}>{staff ? 'Sign out' : 'Sign in'}</button>
        <button type="button" className="mbtn" aria-expanded={open} aria-controls="site-menu" aria-label="Menu" onClick={() => setOpen(!open)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div></header>
      <UrgentBanner />
      <main className="w"><Outlet /></main>
      <footer className="bot"><div className="w">
        <Brand />
        <div className="fl">{MENU.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div>
        <small>© 2026 MutiaraInfo · CMT322 project. Roads, zones and dates are sample data.</small>
      </div></footer>
    </>
  );
}
