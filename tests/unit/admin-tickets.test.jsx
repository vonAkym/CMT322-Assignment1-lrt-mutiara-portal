// Module 4 ticket pages: the dashboard (UC02, UC03, UC05 to UC07, UC10 counts) and the ticket page (UC04 to UC07).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './helpers/render.jsx';

vi.mock('../../src/modules/admin/api.js', () => ({
  listTickets: vi.fn(), getTicket: vi.fn(), updateTicket: vi.fn(), listStaff: vi.fn(), ticketPhotoUrl: vi.fn(),
  replyToTicket: vi.fn(), escalateTicket: vi.fn(),
  myProfile: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
}));
const api = await import('../../src/modules/admin/api.js');
const { default: AdminPage } = await import('../../src/modules/admin/AdminPage.jsx');
const { default: TicketPage } = await import('../../src/modules/admin/TicketPage.jsx');

const ticket = (o) => ({
  id: 1, ticket_no: 'LRT-2026-0001', category: 'Noise', description: 'Piling after 10 pm', location: 'Komtar',
  photo_path: null, reporter_name: 'Ali', is_anonymous: false, status: 'Submitted', priority: 'Medium',
  assigned_to: null, created_at: '2026-11-01T02:00:00Z', ...o,
});
const TICKETS = [
  ticket({ id: 1 }),
  ticket({ id: 2, ticket_no: 'LRT-2026-0002', category: 'Dust', description: 'Dust on cars', status: 'In progress', priority: 'High', assigned_to: 'Construction Team', escalated_at: '2026-11-04T02:00:00Z' }),
  ticket({ id: 3, ticket_no: 'LRT-2026-0003', category: 'Noise', description: 'Generator', status: 'Resolved', priority: 'Low' }),
];
const STAFF = [{ id: 'a', full_name: 'Aisyah', role: 'admin' }];

beforeEach(() => {
  vi.clearAllMocks();
  api.listTickets.mockResolvedValue(TICKETS);
  api.listStaff.mockResolvedValue(STAFF);
});

const dashboard = (at = '/admin') => renderPage(<AdminPage />, { path: '/admin', at, others: ['/manage', '/admin/tickets/:no'] });
const rows = () => screen.getAllByRole('row').slice(1); // without the header row
const tile = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('dashboard: ticket list (UC02)', () => {
  it('lists every ticket from the database with its details', async () => {
    dashboard();
    expect(await screen.findByRole('link', { name: 'LRT-2026-0001' })).toHaveAttribute('href', '/admin/tickets/LRT-2026-0001');
    expect(rows()).toHaveLength(3);
    expect(screen.getByText('3 tickets')).toBeInTheDocument();
    const first = within(rows()[0]);
    expect(first.getByText('Piling after 10 pm')).toBeInTheDocument();
    expect(first.getByText('Komtar')).toBeInTheDocument();
    expect(first.getByLabelText('Priority for LRT-2026-0001')).toHaveValue('Medium');
    expect(first.getByLabelText('Status for LRT-2026-0001')).toHaveValue('Submitted');
    expect(first.getByLabelText('Assignee for LRT-2026-0001')).toHaveValue('');
  });

  it('marks open high-priority tickets', async () => {
    dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0002' });
    expect(rows()[1]).toHaveClass('hi');
    expect(rows()[0]).not.toHaveClass('hi');
  });

  it('says when there are no tickets yet, and when loading fails', async () => {
    api.listTickets.mockResolvedValue([]);
    const r = dashboard();
    expect(await screen.findByText(/No tickets yet/)).toBeInTheDocument();
    r.unmount();
    api.listTickets.mockRejectedValue(new Error('offline'));
    dashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the tickets.');
  });
});

describe('dashboard: counts (UC10, first part)', () => {
  it('counts tickets in total, by status and by category', async () => {
    const { container } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    expect(tile('Total')).toHaveTextContent('3');
    expect(tile('Submitted')).toHaveTextContent('1');
    expect(tile('Under review')).toHaveTextContent('0');
    expect(tile('Resolved')).toHaveTextContent('1');
    const noise = [...container.querySelectorAll('.bar')].find((b) => b.textContent.startsWith('Noise'));
    expect(noise).toHaveTextContent('Noise2');
  });
  it('a status tile filters the list, and selecting it again clears the filter', async () => {
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await user.click(tile('In progress'));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin?status=In+progress');
    expect(tile('In progress')).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toHaveLength(1);
    await user.click(tile('In progress'));
    expect(rows()).toHaveLength(3);
  });
});

describe('dashboard: search and filter (UC03)', () => {
  it('reads filters from the address', async () => {
    dashboard('/admin?category=Noise&priority=Low');
    await screen.findByRole('link', { name: 'LRT-2026-0003' });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('1 of 3 tickets')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toHaveValue('Noise');
  });
  it('filters by keyword after typing stops, and by ticket number', async () => {
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await user.type(screen.getByLabelText('Search'), '0002');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByTestId('where')).toHaveTextContent('q=0002');
  });
  it('filters unassigned tickets and by assignee', async () => {
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0001' });
    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Unassigned');
    expect(rows()).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Construction Team');
    expect(rows()).toHaveLength(1);
  });
  it('says when nothing matches, and Clear filters shows everything again', async () => {
    const { user } = dashboard('/admin?category=Dust&status=Resolved');
    expect(await screen.findByText('No tickets match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rows()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('dashboard: changing a ticket from the list (UC05 to UC07)', () => {
  it('saves a new status and says so', async () => {
    api.updateTicket.mockImplementation(async (id, ch) => ({ ...TICKETS[0], ...ch }));
    const { user } = dashboard();
    await user.selectOptions(await screen.findByLabelText('Status for LRT-2026-0001'), 'Under review');
    expect(api.updateTicket).toHaveBeenCalledWith(1, { status: 'Under review' });
    expect(await screen.findByText('Saved LRT-2026-0001.')).toBeInTheDocument();
    expect(tile('Under review')).toHaveTextContent('1');
  });
  it('saves priority and assignee; choosing Unassigned saves an empty assignee', async () => {
    api.updateTicket.mockImplementation(async (id, ch) => ({ ...TICKETS[1], ...ch }));
    const { user } = dashboard();
    await user.selectOptions(await screen.findByLabelText('Priority for LRT-2026-0002'), 'Low');
    expect(api.updateTicket).toHaveBeenLastCalledWith(2, { priority: 'Low' });
    await user.selectOptions(screen.getByLabelText('Assignee for LRT-2026-0002'), 'Aisyah (Admin)');
    expect(api.updateTicket).toHaveBeenLastCalledWith(2, { assigned_to: 'Aisyah' });
    await user.selectOptions(screen.getByLabelText('Assignee for LRT-2026-0002'), 'Unassigned');
    expect(api.updateTicket).toHaveBeenLastCalledWith(2, { assigned_to: null });
  });
  it('puts the old value back when saving fails', async () => {
    api.updateTicket.mockRejectedValue(new Error('denied'));
    const { user } = dashboard();
    const status = await screen.findByLabelText('Status for LRT-2026-0001');
    await user.selectOptions(status, 'Resolved');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save LRT-2026-0001.');
    expect(status).toHaveValue('Submitted');
  });
});

describe('ticket page (UC04 to UC07)', () => {
  const FULL = ticket({
    photo_path: 'abc.jpg', priority: 'High', status: 'Under review', assigned_to: 'Officer A',
    history: [{ id: 10, status: 'Submitted', note: null, created_at: '2026-11-01T02:00:00Z' }, { id: 11, status: 'Under review', note: null, created_at: '2026-11-02T02:00:00Z' }],
  });
  const open = (no = 'LRT-2026-0001', state) =>
    renderPage(<TicketPage />, { path: '/admin/tickets/:no', at: state ? { pathname: `/admin/tickets/${no}`, state } : `/admin/tickets/${no}`, others: ['/admin'] });

  it('shows the full details: description, location, reporter, photo and history', async () => {
    api.getTicket.mockResolvedValue(FULL);
    api.ticketPhotoUrl.mockResolvedValue('https://signed.test/abc.jpg');
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'LRT-2026-0001' })).toBeInTheDocument();
    expect(api.getTicket).toHaveBeenCalledWith('LRT-2026-0001');
    expect(screen.getByText('Piling after 10 pm')).toBeInTheDocument();
    expect(screen.getByText('High priority')).toBeInTheDocument();
    const facts = within(screen.getByRole('heading', { name: 'Key facts' }).closest('.card'));
    expect(facts.getByText('Komtar')).toBeInTheDocument();
    expect(facts.getByText('Ali')).toBeInTheDocument();
    expect(facts.getByText('Officer A')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Photo sent with LRT-2026-0001' })).toHaveAttribute('src', 'https://signed.test/abc.jpg');
    expect(api.ticketPhotoUrl).toHaveBeenCalledWith('abc.jpg');
    const history = within(screen.getByRole('list'));
    expect(history.getAllByRole('listitem').map((li) => li.querySelector('b').textContent)).toEqual(['Submitted', 'Under review']);
  });

  it('shows Anonymous and no photo when the reporter chose so', async () => {
    api.getTicket.mockResolvedValue({ ...FULL, reporter_name: null, is_anonymous: true, photo_path: null });
    open();
    expect(await screen.findByText('Anonymous')).toBeInTheDocument();
    expect(screen.getByText('No photo was sent.')).toBeInTheDocument();
  });

  it('keeps an assignee from before the staff list existed', async () => {
    api.getTicket.mockResolvedValue(FULL);
    api.ticketPhotoUrl.mockResolvedValue('x');
    open();
    expect(await screen.findByLabelText('Assigned to')).toHaveValue('Officer A');
  });

  it('saves only what changed, then shows the new history entry', async () => {
    api.getTicket.mockResolvedValueOnce(FULL).mockResolvedValueOnce({
      ...FULL, status: 'In progress', priority: 'Medium', history: [...FULL.history, { id: 12, status: 'In progress', note: null, created_at: '2026-11-03T02:00:00Z' }],
    });
    api.ticketPhotoUrl.mockResolvedValue('x');
    api.updateTicket.mockResolvedValue({});
    const { user } = open();
    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled(); // nothing changed yet
    await user.selectOptions(screen.getByLabelText('Status'), 'In progress');
    await user.selectOptions(screen.getByLabelText('Priority'), 'Medium');
    await user.click(save);
    expect(api.updateTicket).toHaveBeenCalledWith(1, { status: 'In progress', priority: 'Medium' });
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('assigning to a staff member saves their name; Unassigned saves nothing', async () => {
    api.getTicket.mockResolvedValue({ ...FULL, history: FULL.history });
    api.ticketPhotoUrl.mockResolvedValue('x');
    api.updateTicket.mockResolvedValue({});
    const { user } = open();
    await user.selectOptions(await screen.findByLabelText('Assigned to'), 'Unassigned');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(api.updateTicket).toHaveBeenCalledWith(1, { assigned_to: null });
  });

  it('says when saving fails and keeps the choices', async () => {
    api.getTicket.mockResolvedValue(FULL);
    api.ticketPhotoUrl.mockResolvedValue('x');
    api.updateTicket.mockRejectedValue(new Error('denied'));
    const { user } = open();
    await user.selectOptions(await screen.findByLabelText('Status'), 'Resolved');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes.');
    expect(screen.getByLabelText('Status')).toHaveValue('Resolved');
  });

  it('says when there is no such ticket, with a way back', async () => {
    api.getTicket.mockResolvedValue(null);
    const { user } = open('LRT-0000');
    expect(await screen.findByRole('heading', { name: 'No ticket LRT-0000' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to all tickets' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin$/);
  });

  it('the back link returns to the dashboard with the same filters', async () => {
    api.getTicket.mockResolvedValue(FULL);
    api.ticketPhotoUrl.mockResolvedValue('x');
    const { user } = open('LRT-2026-0001', { back: '?status=Submitted' });
    await user.click(await screen.findByRole('link', { name: '← All tickets' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin?status=Submitted');
  });

  it('says when the photo cannot be loaded', async () => {
    api.getTicket.mockResolvedValue(FULL);
    api.ticketPhotoUrl.mockRejectedValue(new Error('denied'));
    open();
    expect(await screen.findByText('The photo could not be loaded.')).toBeInTheDocument();
  });
});

describe('dashboard: escalated tickets (UC09)', () => {
  it('marks escalated tickets and can show only those', async () => {
    const { user } = dashboard();
    await screen.findByRole('link', { name: 'LRT-2026-0002' });
    expect(within(rows()[1]).getByText('Escalated')).toBeInTheDocument();
    expect(within(rows()[0]).queryByText('Escalated')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Escalated to the government only'));
    expect(rows()).toHaveLength(1);
    expect(screen.getByTestId('where')).toHaveTextContent('escalated=1');
  });
});

describe('ticket page: reply to resident (UC08)', () => {
  const BASE = ticket({ history: [{ id: 10, kind: 'status', status: 'Submitted', note: null, created_at: '2026-11-01T02:00:00Z' }] });
  const open = () => renderPage(<TicketPage />, { path: '/admin/tickets/:no', at: '/admin/tickets/LRT-2026-0001', others: ['/admin'] });

  it('checks the reply, sends it, and shows it in the history', async () => {
    api.getTicket.mockResolvedValueOnce(BASE).mockResolvedValueOnce({
      ...BASE, history: [...BASE.history, { id: 11, kind: 'reply', status: 'Submitted', note: 'We will stop work at 10 pm.', created_at: '2026-11-02T02:00:00Z' }],
    });
    api.replyToTicket.mockResolvedValue({});
    const { user } = open();
    const box = await screen.findByLabelText('Your reply');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write the reply (at least 5 characters).');
    expect(box).toHaveFocus();
    expect(api.replyToTicket).not.toHaveBeenCalled();
    await user.type(box, 'We will stop work at 10 pm.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(api.replyToTicket).toHaveBeenCalledWith(1, 'We will stop work at 10 pm.');
    expect(await screen.findByText('Reply sent. The resident sees it when they track this ticket.')).toBeInTheDocument();
    expect(screen.getByText('Reply to resident')).toBeInTheDocument();
    expect(screen.getByText('We will stop work at 10 pm.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your reply')).toHaveValue('');
  });

  it('explains when the database has not been updated yet, and keeps the text', async () => {
    api.getTicket.mockResolvedValue(BASE);
    api.replyToTicket.mockRejectedValue({ code: 'PGRST202', message: 'Could not find the function public.reply_to_ticket' });
    const { user } = open();
    await user.type(await screen.findByLabelText('Your reply'), 'We are on it.');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('the database needs the latest update');
    expect(screen.getByLabelText('Your reply')).toHaveValue('We are on it.');
  });
});

describe('ticket page: escalate (UC09)', () => {
  const BASE = ticket({ history: [{ id: 10, kind: 'status', status: 'Submitted', note: null, created_at: '2026-11-01T02:00:00Z' }] });
  const open = () => renderPage(<TicketPage />, { path: '/admin/tickets/:no', at: '/admin/tickets/LRT-2026-0001', others: ['/admin'] });

  it('asks for a reason, can be cancelled, then escalates', async () => {
    api.getTicket.mockResolvedValueOnce(BASE).mockResolvedValueOnce({
      ...BASE, escalated_at: '2026-11-02T02:00:00Z', escalation_reason: 'Drain belongs to the council.', assigned_to: 'Government Officers',
      history: [...BASE.history, { id: 11, kind: 'escalated', status: 'Submitted', note: 'Drain belongs to the council.', created_at: '2026-11-02T02:00:00Z' }],
    });
    api.escalateTicket.mockResolvedValue({});
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: /^Escalate/ }));
    const reason = screen.getByLabelText('Why does this need the government?');
    expect(reason).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Why does this need the government?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Escalate/ }));
    await user.click(screen.getByRole('button', { name: 'Escalate ticket' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write the reason');
    await user.type(screen.getByLabelText('Why does this need the government?'), 'Drain belongs to the council.');
    await user.click(screen.getByRole('button', { name: 'Escalate ticket' }));
    expect(api.escalateTicket).toHaveBeenCalledWith(1, 'Drain belongs to the council.');
    expect(await screen.findByText('Ticket escalated to the government officers.')).toBeInTheDocument();
    expect(screen.getByText('Escalated to the government')).toBeInTheDocument();
    expect(screen.getByText(/Escalated on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Escalate/ })).not.toBeInTheDocument();
  });

  it('an escalated ticket shows when and why instead of the button', async () => {
    api.getTicket.mockResolvedValue({ ...BASE, escalated_at: '2026-11-02T02:00:00Z', escalation_reason: 'Public road.' });
    open();
    expect(await screen.findByText(/Escalated on/)).toBeInTheDocument();
    expect(screen.getByText('Public road.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Escalate/ })).not.toBeInTheDocument();
  });
});
