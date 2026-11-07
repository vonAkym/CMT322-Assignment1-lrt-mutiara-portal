// Puts every module's pages inside the shared layout.
// To add a page: add it to the routes.jsx of its module. To add a module: create src/modules/<name>/routes.jsx and list it here.
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import Layout from './shared/Layout.jsx';
import { StaffProvider, useStaff } from './shared/staff.jsx';
import advisories from './modules/advisories/routes.jsx';
import map from './modules/map/routes.jsx';
import complaints from './modules/complaints/routes.jsx';
import admin from './modules/admin/routes.jsx';
import landing from './landing-alternatives/routes.jsx';

const PAGES = [...advisories, ...map, ...complaints, ...admin];

// Staff pages send everyone else back to the home page.
function StaffOnly({ children }) {
  const { staff } = useStaff();
  return staff ? children : <Navigate to="/" replace />;
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
