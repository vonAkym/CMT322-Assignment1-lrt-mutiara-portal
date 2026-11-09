// Renders one page at an address, with a small marker that shows where the app navigated to.
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

function Where() {
  const { pathname, search } = useLocation();
  return <code data-testid="where">{pathname + search}</code>;
}

// renderPage(<ReportPage />, { path: '/report', at: '/report?location=Komtar' })
export function renderPage(element, { path = '/', at = path, others = [] } = {}) {
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path={path} element={element} />
        {others.map((p) => <Route key={p} path={p} element={<p>Other page {p}</p>} />)}
        <Route path="*" element={<p>Other page</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  return { user, ...utils };
}

export const SAMPLE_ZONES = [{ id: 1, name: 'George Town' }, { id: 2, name: 'Jelutong' }];

// A published advisory with sensible defaults; pass only what a test cares about.
export const advisory = (o = {}) => ({
  id: 1, title: 'Lane closure on Jalan Sample', body: 'One lane closed for piling.', category: 'Road closure',
  status: 'Ongoing', severity: 'Low', state: 'Published', location: 'Jalan Sample', starts_on: '2026-11-01',
  ends_on: '2026-12-31', work_hours: '9am to 5pm', detour: null, affected_businesses: null, photo_paths: [],
  zone_id: 1, zones: { name: 'George Town' }, created_at: '2026-11-01T00:00:00Z', updated_at: new Date().toISOString(), ...o,
});
