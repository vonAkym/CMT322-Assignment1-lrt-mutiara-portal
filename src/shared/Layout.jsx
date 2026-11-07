// The frame around every page: header with the menu, urgent banner, the page itself, and the footer.
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import UrgentBanner from '../modules/advisories/UrgentBanner.jsx';
import { useStaff } from './staff.jsx';

const MENU = [['/advisories', 'Advisories'], ['/schedule', 'Schedule'], ['/map', 'Map'], ['/report', 'Report'], ['/track', 'Feedback']];
const STAFF_MENU = [['/manage', 'My advisories'], ['/admin', 'Admin']];

const Logo = () => (
  <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="24" fill="#fff" />
    <rect x="15" y="12" width="18" height="20" rx="4" fill="none" stroke="#143C6B" strokeWidth="2.5" />
    <path d="M15 23H33" stroke="#143C6B" strokeWidth="2.5" />
    <circle cx="20" cy="27.5" r="1.7" fill="#143C6B" /><circle cx="28" cy="27.5" r="1.7" fill="#143C6B" />
    <path d="M19 36l-3 4M29 36l3 4" stroke="#143C6B" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export default function Layout() {
  const { staff, setStaff } = useStaff();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Each new page starts at the top.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  // Simulated sign-in: shows or hides the staff pages.
  const toggleSignIn = () => { setStaff(!staff); navigate(staff ? '/' : '/admin'); };

  return (
    <>
      <header><div className="w">
        <Link className="brand" to="/" aria-label="MutiaraInfo, home"><Logo /><b>MutiaraInfo</b></Link>
        <nav aria-label="Main">
          {[...MENU, ...(staff ? STAFF_MENU : [])].map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        </nav>
        <button className="btn o sp" onClick={toggleSignIn}>{staff ? 'Sign out' : 'Sign in'}</button>
      </div></header>
      <UrgentBanner />
      <main className="w"><Outlet /></main>
      <footer><div className="w">
        <span>© 2026 MutiaraInfo · CMT322 project</span>
        <div className="fl">{MENU.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div>
      </div></footer>
    </>
  );
}
