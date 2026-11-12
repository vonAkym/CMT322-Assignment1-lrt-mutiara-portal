// Module 4: accounts and the staff dashboard. The pages of this module and their addresses.
import AdminPage from './AdminPage.jsx';
import LoginPage from './LoginPage.jsx';
import TicketPage from './TicketPage.jsx';
import StaffPage from './StaffPage.jsx';

export default [
  { path: '/login', element: <LoginPage /> },
  { path: '/admin', element: <AdminPage />, staff: true },
  { path: '/admin/tickets/:no', element: <TicketPage />, staff: true },
  { path: '/admin/staff', element: <StaffPage />, staff: true }, // admins only (the page checks)
];
