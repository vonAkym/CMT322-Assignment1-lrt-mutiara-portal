// Puts every module's pages inside the shared layout.
// To add a page: add it to the routes.jsx of its module. To add a module: create src/modules/<name>/routes.jsx and list it here.
import { useRef } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import Layout from './shared/Layout.jsx';
import { StaffProvider, useStaff } from './shared/staff.jsx';
import advisories from './modules/advisories/routes.jsx';
import map from './modules/map/routes.jsx';
import complaints from './modules/complaints/routes.jsx';
import admin from './modules/admin/routes.jsx';
import landing from './landing-alternatives/routes.jsx';

const PAGES = [...advisories, ...map, ...complaints, ...admin];

// Staff pages send everyone else to the sign-in page, which brings them back here afterwards.
// Nothing shows while the saved session is still being checked, so a refresh does not bounce staff away.
// Someone who signs out while on a staff page (here or in another tab) goes home instead of to the sign-in page.
function StaffOnly({ children }) {
  const { ready, staff } = useStaff();
  const { pathname } = useLocation();
  const wasStaff = useRef(false);
  if (staff) wasStaff.current = true;
  if (!ready) return <p className="mut" role="status" style={{ padding: '40px 0' }}>Checking your sign-in…</p>;
  if (staff) return children;
  return wasStaff.current ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ from: pathname }} />;
}

export default function App() {
  return (
    // HashRouter keeps the page address after a # (e.g. /#/advisories/12), so GitHub Pages needs no extra setup.
    <HashRouter>
      <StaffProvider>
        <Routes>
          <Route element={<Layout />}>
            {PAGES.map((p) => <Route key={p.path} path={p.path} element={p.staff ? <StaffOnly>{p.element}</StaffOnly> : p.element} />)}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          {/* Landing page alternatives have their own navbar and footer (src/landing-alternatives). */}
          {landing.map((p) => <Route key={p.path} path={p.path} element={p.element} />)}
        </Routes>
      </StaffProvider>
    </HashRouter>
  );
}
