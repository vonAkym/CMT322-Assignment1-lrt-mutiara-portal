// Module 1: Construction Advisory Hub. The pages of this module and their addresses.
import HomePage from './HomePage.jsx';
import AdvisoriesPage from './AdvisoriesPage.jsx';
import AdvisoryPage from './AdvisoryPage.jsx';
import SchedulePage from './SchedulePage.jsx';
import ManagePage from './ManagePage.jsx';
import AdvisoryFormPage from './AdvisoryFormPage.jsx';

export default [
  { path: '/', element: <HomePage /> },
  { path: '/advisories', element: <AdvisoriesPage /> },
  { path: '/advisories/:id', element: <AdvisoryPage /> },
  { path: '/schedule', element: <SchedulePage /> },
  { path: '/manage', element: <ManagePage />, staff: true },
  { path: '/manage/new', element: <AdvisoryFormPage />, staff: true },
  { path: '/manage/:id/edit', element: <AdvisoryFormPage />, staff: true },
];
