// Module 4 pages, the parts added to finish the module: role-based controls (Figure 4), area, response figures
// and the report (UC10, UC11) on the dashboard; role rules on the ticket page; Manage staff roles (UC12).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './helpers/render.jsx';

const me = vi.hoisted(() => ({ profile: { full_name: 'Aisyah', role: 'admin' }, user: { id: 'a' } }));
vi.mock('../../src/shared/staff.jsx', async (orig) => ({ ...(await orig()), useStaff: () => me }));
vi.mock('../../src/shared/supabase.js', async (orig) => {
  const { SAMPLE_ZONES } = await import('./helpers/render.jsx');
  return { ...(await orig()), listZones: async () => SAMPLE_ZONES };
});
vi.mock('../../src/modules/admin/api.js', () => ({
  listTickets: vi.fn(), listTicketEvents: vi.fn(), getTicket: vi.fn(), updateTicket: vi.fn(), listStaff: vi.fn(),
  ticketPhotoUrl: vi.fn(), replyToTicket: vi.fn(), escalateTicket: vi.fn(), listAccounts: vi.fn(), setAccount: vi.fn(),
}));
const api = await import('../../src/modules/admin/api.js');
const { default: AdminPage } = await import('../../src/modules/admin/AdminPage.jsx');
const { default: TicketPage } = await import('../../src/modules/admin/TicketPage.jsx');
const { default: StaffPage } = await import('../../src/modules/admin/StaffPage.jsx');

const ticket = (o) => ({
  id: 1, ticket_no: 'LRT-2026-0001', category: 'Noise', description: 'Piling at night', location: 'Komtar', photo_path: null,
  reporter_name: 'Ali', is_anonymous: false, status: 'Submitted', priority: 'Medium', assigned_to: null, escalated_at: null,
  zone_id: 1, created_at: '2026-11-01T00:00:00Z', history: [], ...o,
});
const TICKETS = [
  ticket({ id: 1 }),
  ticket({ id: 2, ticket_no: 'LRT-2026-0002', zone_id: 2, assigned_to: 'Construction Team', status: 'In progress', created_at: '2026-11-02T00:00:00Z' }),
  ticket({ id: 3, ticket_no: 'LRT-2026-0003', zone_id: null, escalated_at: '2026-11-03T00:00:00Z', assigned_to: 'Government Officers', created_at: '2026-11-03T00:00:00Z' }),
];
const EVENTS = [{ ticket_id: 2, kind: 'status', status: 'In progress', created_at: '2026-11-02T04:00:00Z' }];

beforeEach(() => {
  vi.clearAllMocks();
  me.profile = { full_name: 'Aisyah', role: 'admin' };
  api.listTickets.mockResolvedValue(TICKETS);
  api.listTicketEvents.mockResolvedValue(EVENTS);
  api.listStaff.mockResolvedValue([]);
});

const dashboard = (at = '/admin') => renderPage(<AdminPage />, { path: '/admin', at, others: ['/manage', '/admin/staff', '/admin/tickets/:no'] });
const rows = () => screen.getAllByRole('row').slice(1);
const card = (label) => screen.getByText(label, { selector: '.stats .mut' }).closest('.card');

describe('dashboard figures (UC10)', () => {
  it('shows the average first response, the waiting tickets, escalations and open high-priority tickets', async () => {
    dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await waitFor(() => expect(card('Average first response')).toHaveTextContent('4 h'));
    expect(card('Average first response')).toHaveTextContent('over 1 answered ticket');
    expect(card('Waiting for a first response')).toHaveTextContent('2');
    expect(card('Escalated to the government')).toHaveTextContent('1');
  });
  it('counts tickets by area, including those without one', async () => {
    const { container } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    const bar = (name) => [...container.querySelectorAll('.bar')].find((b) => b.querySelector('span').textContent === name);
    await waitFor(() => expect(bar('George Town')).toHaveTextContent('1'));
    expect(bar('Jelutong')).toHaveTextContent('1');
    expect(bar('No area given')).toHaveTextContent('1');
  });
  it('shows each ticket’s area and filters by it (UC02, UC03)', async () => {
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await waitFor(() => expect(within(rows()[0]).getByText('George Town')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Area'), 'Jelutong');
    expect(rows()).toHaveLength(1);
    expect(screen.getByTestId('where')).toHaveTextContent('zone=2');
  });
});

describe('dashboard report (UC11)', () => {
  let created;
  beforeEach(() => {
    created = [];
    URL.createObjectURL = vi.fn((blob) => { created.push(blob); return 'blob:report'; });
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('downloads a CSV of the figures and the tickets that match the filters', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = dashboard('/admin?zone=1');
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await user.click(screen.getByRole('button', { name: 'Download report (CSV)' }));
    expect(click).toHaveBeenCalled();
    // jsdom's Blob has no text(), so read it the older way.
    const text = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(created[0]); });
    expect(text).toContain('MutiaraInfo ticket summary report');
    expect(text).toContain('Filters,zone=1');
    expect(text).toContain('LRT-2026-0001');
    expect(text).not.toContain('LRT-2026-0002');
  });
  it('prints the dashboard (to paper or PDF)', async () => {
    window.print = vi.fn();
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
    expect(window.print).toHaveBeenCalled();
  });
});

describe('dashboard controls follow the role (Figure 4)', () => {
  it('admins can change everything and reach Manage staff roles', async () => {
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    expect(screen.getByLabelText('Priority for LRT-2026-0001')).toBeEnabled();
    expect(screen.getByLabelText('Assignee for LRT-2026-0001')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Manage staff roles' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/staff');
  });
  it('the Construction Team changes status only on its own tickets, and never priority or assignee', async () => {
    me.profile = { full_name: 'Ravi', role: 'construction' };
    dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    expect(screen.getByText(/As Construction Team you can change the status/)).toBeInTheDocument();
    expect(screen.getByLabelText('Status for LRT-2026-0002')).toBeEnabled();   // given to the Construction Team
    expect(screen.getByLabelText('Status for LRT-2026-0001')).toBeDisabled();  // unassigned
    expect(screen.getByLabelText('Status for LRT-2026-0003')).toBeDisabled();  // escalated
    expect(screen.getByLabelText('Priority for LRT-2026-0002')).toBeDisabled();
    expect(screen.getByLabelText('Assignee for LRT-2026-0002')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Manage staff roles' })).not.toBeInTheDocument();
  });
  it('“Tickets I can work on” shows a Government Officer the escalated ticket', async () => {
    me.profile = { full_name: 'Siti', role: 'government' };
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Tickets I can work on');
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByRole('link')).toHaveTextContent('LRT-2026-0003');
    expect(screen.getByLabelText('Status for LRT-2026-0003')).toBeEnabled();
  });
  it('shows the database’s reason when it refuses a change', async () => {
    api.updateTicket.mockRejectedValue({ code: '42501', message: 'This ticket is not assigned to you' });
    const { user } = dashboard();
    await user.selectOptions(await screen.findByLabelText('Status for LRT-2026-0001'), 'Resolved');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save LRT-2026-0001: This ticket is not assigned to you.');
  });
});

describe('ticket page follows the role (Figure 4)', () => {
  const open = (t) => {
    api.getTicket.mockResolvedValue(t);
    return renderPage(<TicketPage />, { path: '/admin/tickets/:no', at: `/admin/tickets/${t.ticket_no}`, others: ['/admin'] });
  };
  it('shows the area', async () => {
    open(ticket({}));
    const facts = within((await screen.findByRole('heading', { name: 'Key facts' })).closest('.card'));
    await waitFor(() => expect(facts.getByText('George Town')).toBeInTheDocument());
  });
  it('Construction Team on its own ticket: status and reply, but not priority, assignee or escalation', async () => {
    me.profile = { full_name: 'Ravi', role: 'construction' };
    open(ticket({ assigned_to: 'Construction Team' }));
    expect(await screen.findByLabelText('Status')).toBeEnabled();
    expect(screen.getByLabelText('Priority')).toBeDisabled();
    expect(screen.getByLabelText('Assigned to')).toBeDisabled();
    expect(screen.getByLabelText('Your reply')).toBeInTheDocument();
    expect(screen.getByText('Only an admin can escalate a ticket.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Escalate/ })).not.toBeInTheDocument();
  });
  it('a ticket not assigned to them is read-only', async () => {
    me.profile = { full_name: 'Ravi', role: 'construction' };
    open(ticket({ assigned_to: null }));
    expect(await screen.findByText(/read-only for you/)).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(screen.queryByLabelText('Your reply')).not.toBeInTheDocument();
    expect(screen.getByText(/Only the staff this ticket is assigned to/)).toBeInTheDocument();
  });
});

describe('Manage staff roles (UC12)', () => {
  const ACCOUNTS = [
    { id: 'a', email: 'aisyah@example.com', full_name: 'Aisyah', role: 'admin', created_at: '2026-11-01T00:00:00Z' },
    { id: 'b', email: 'ravi@example.com', full_name: 'Ravi', role: 'construction', created_at: '2026-11-02T00:00:00Z' },
    { id: 'c', email: 'new@example.com', full_name: null, role: 'resident', created_at: '2026-11-03T00:00:00Z' },
  ];
  const open = () => renderPage(<StaffPage />, { path: '/admin/staff', others: ['/admin'] });

  it('is for admins only', () => {
    me.profile = { full_name: 'Ravi', role: 'construction' };
    open();
    expect(screen.getByRole('alert')).toHaveTextContent('Only admins can manage staff roles.');
    expect(api.listAccounts).not.toHaveBeenCalled();
  });
  it('lists every account with its email and role, and locks the admin’s own role', async () => {
    api.listAccounts.mockResolvedValue(ACCOUNTS);
    open();
    expect(await screen.findByText('3 accounts, 2 with staff access')).toBeInTheDocument();
    expect(screen.getByLabelText('Role for ravi@example.com')).toHaveValue('construction');
    expect(screen.getByLabelText('Role for new@example.com')).toHaveValue('resident');
    expect(screen.getByLabelText('Role for aisyah@example.com')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save ravi@example.com' })).toBeDisabled(); // nothing changed yet
  });
  it('gives a new account a staff role and a name', async () => {
    api.listAccounts.mockResolvedValue(ACCOUNTS);
    api.setAccount.mockResolvedValue({ id: 'c', role: 'government', full_name: 'Siti' });
    const { user } = open();
    await user.selectOptions(await screen.findByLabelText('Role for new@example.com'), 'Government Officer');
    await user.click(screen.getByRole('button', { name: 'Save new@example.com' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Staff need a name');
    expect(api.setAccount).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Name for new@example.com'), 'Siti');
    await user.click(screen.getByRole('button', { name: 'Save new@example.com' }));
    expect(api.setAccount).toHaveBeenCalledWith('c', 'government', 'Siti');
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.getByText('3 accounts, 3 with staff access')).toBeInTheDocument();
  });
  it('takes staff access away', async () => {
    api.listAccounts.mockResolvedValue(ACCOUNTS);
    api.setAccount.mockResolvedValue({ id: 'b', role: 'resident', full_name: 'Ravi' });
    const { user } = open();
    await user.selectOptions(await screen.findByLabelText('Role for ravi@example.com'), 'No staff access');
    await user.click(screen.getByRole('button', { name: 'Save ravi@example.com' }));
    expect(api.setAccount).toHaveBeenCalledWith('b', 'resident', 'Ravi');
  });
  it('shows the database’s reason when it refuses', async () => {
    api.listAccounts.mockResolvedValue(ACCOUNTS);
    api.setAccount.mockRejectedValue({ code: '42501', message: 'Only admins can manage staff' });
    const { user } = open();
    await user.selectOptions(await screen.findByLabelText('Role for ravi@example.com'), 'Admin');
    await user.click(screen.getByRole('button', { name: 'Save ravi@example.com' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this account: Only admins can manage staff.');
  });
  it('explains when the database update has not been run', async () => {
    api.listAccounts.mockRejectedValue({ code: 'PGRST202', message: 'Could not find the function public.list_accounts' });
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('the database needs the latest update');
  });
});
