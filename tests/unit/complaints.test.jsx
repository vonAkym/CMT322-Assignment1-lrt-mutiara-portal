// Module 3 pages: Report a concern and Feedback (ticket tracking). The database calls are mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from './helpers/render.jsx';

vi.mock('../../src/modules/complaints/api.js', () => ({ submitTicket: vi.fn(), trackTicket: vi.fn() }));
const api = await import('../../src/modules/complaints/api.js');
const { default: ReportPage } = await import('../../src/modules/complaints/ReportPage.jsx');
const { default: TrackPage } = await import('../../src/modules/complaints/TrackPage.jsx');

beforeEach(() => { vi.clearAllMocks(); });

const photo = (name, type, size = 2000) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('Report a concern', () => {
  it('fills in the location from the address (links from the map and advisories)', () => {
    renderPage(<ReportPage />, { path: '/report', at: '/report?location=Komtar' });
    expect(screen.getByLabelText('Location')).toHaveValue('Komtar');
  });

  it('asks for a description of at least 5 characters', async () => {
    const { user } = renderPage(<ReportPage />, { path: '/report' });
    await user.type(screen.getByLabelText('Describe the issue'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Submit concern' }));
    expect(screen.getByText('Please describe the issue (at least 5 characters).')).toBeInTheDocument();
    expect(api.submitTicket).not.toHaveBeenCalled();
  });

  it('refuses a photo that is not JPG or PNG', async () => {
    const { user } = renderPage(<ReportPage />, { path: '/report' });
    await user.type(screen.getByLabelText('Describe the issue'), 'Loud piling at night');
    // Picked with "All files" in the file dialog, so the accept filter does not stop it.
    fireEvent.change(screen.getByLabelText(/^Photo/), { target: { files: [photo('a.gif', 'image/gif')] } });
    await user.click(screen.getByRole('button', { name: 'Submit concern' }));
    expect(screen.getByText('Photo must be a JPG or PNG up to 5 MB.')).toBeInTheDocument();
    expect(api.submitTicket).not.toHaveBeenCalled();
  });

  it('refuses a photo over 5 MB', async () => {
    const { user } = renderPage(<ReportPage />, { path: '/report' });
    await user.type(screen.getByLabelText('Describe the issue'), 'Loud piling at night');
    await user.upload(screen.getByLabelText(/^Photo/), photo('big.jpg', 'image/jpeg', 6 * 1024 * 1024));
    await user.click(screen.getByRole('button', { name: 'Submit concern' }));
    expect(screen.getByText('Photo must be a JPG or PNG up to 5 MB.')).toBeInTheDocument();
  });

  it('sends the concern, shows the ticket number and clears the form', async () => {
    api.submitTicket.mockResolvedValue('LRT-2026-0042');
    const { user } = renderPage(<ReportPage />, { path: '/report', others: ['/track'] });
    await user.selectOptions(screen.getByLabelText('Category'), 'Dust');
    await user.type(screen.getByLabelText('Describe the issue'), '  Dust all over the shop front  ');
    await user.type(screen.getByLabelText('Location'), 'Jalan Sample');
    await user.click(screen.getByRole('checkbox', { name: /without my name/ }));
    await user.click(screen.getByRole('button', { name: 'Submit concern' }));
    expect(await screen.findByText('LRT-2026-0042')).toBeInTheDocument();
    expect(api.submitTicket).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Dust', description: 'Dust all over the shop front', location: 'Jalan Sample', anonymous: true, file: undefined,
    }));
    expect(screen.getByLabelText('Describe the issue')).toHaveValue('');
  });

  it('opens tracking for the new ticket', async () => {
    api.submitTicket.mockResolvedValue('LRT-2026-0042');
    const { user } = renderPage(<ReportPage />, { path: '/report', others: ['/track'] });
    await user.type(screen.getByLabelText('Describe the issue'), 'Blocked entrance');
    await user.click(screen.getByRole('button', { name: 'Submit concern' }));
    await user.click(await screen.findByRole('button', { name: 'Track this ticket' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/track?ticket=LRT-2026-0042');
  });

  it('says so when sending fails', async () => {
    api.submitTicket.mockRejectedValue(new Error('offline'));
    const { user } = renderPage(<ReportPage />, { path: '/report' });
    await user.type(screen.getByLabelText('Describe the issue'), 'Blocked entrance');
    await user.click(screen.getByRole('button', { name: 'Submit concern' }));
    expect(await screen.findByText('Could not send your concern: offline')).toBeInTheDocument();
  });
});

describe('Feedback: track a ticket', () => {
  const TICKET = {
    ticket_no: 'LRT-2026-0001', category: 'Noise', location: 'Komtar', status: 'In progress', assigned_to: 'Officer A',
    history: [{ status: 'Submitted', at: '2026-11-01T02:00:00Z' }, { status: 'In progress', at: '2026-11-02T02:00:00Z' }],
  };

  it('looks up the ticket in the address straight away', async () => {
    api.trackTicket.mockResolvedValue(TICKET);
    renderPage(<TrackPage />, { path: '/track', at: '/track?ticket=LRT-2026-0001' });
    expect(await screen.findByRole('heading', { name: 'LRT-2026-0001' })).toBeInTheDocument();
    expect(api.trackTicket).toHaveBeenCalledWith('LRT-2026-0001');
    expect(screen.getByText(/Assigned to: Officer A/)).toBeInTheDocument();
    expect(screen.getByText('In progress', { selector: 'span[style]' })).toBeInTheDocument(); // current step in bold
  });

  it('shows the steps done so far', async () => {
    api.trackTicket.mockResolvedValue(TICKET);
    const { container } = renderPage(<TrackPage />, { path: '/track', at: '/track?ticket=LRT-2026-0001' });
    await screen.findByRole('heading', { name: 'LRT-2026-0001' });
    expect(container.querySelectorAll('.step.d')).toHaveLength(3); // Submitted, Under review, In progress
  });

  it('says when no ticket has that number', async () => {
    api.trackTicket.mockResolvedValue(null);
    const { user } = renderPage(<TrackPage />, { path: '/track' });
    await user.type(screen.getByLabelText('Ticket number'), 'LRT-0000{Enter}');
    expect(await screen.findByText('No ticket found with that number.')).toBeInTheDocument();
  });

  it('puts the number in the address, so the page can be shared or refreshed', async () => {
    api.trackTicket.mockResolvedValue(TICKET);
    const { user } = renderPage(<TrackPage />, { path: '/track' });
    await user.type(screen.getByLabelText('Ticket number'), ' LRT-2026-0001 ');
    await user.click(screen.getByRole('button', { name: 'Check status' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/track?ticket=LRT-2026-0001'));
  });

  it('shows an error when the check fails', async () => {
    api.trackTicket.mockRejectedValue(new Error('offline'));
    renderPage(<TrackPage />, { path: '/track', at: '/track?ticket=LRT-2026-0001' });
    expect(await screen.findByText('Could not check the ticket. Please try again later.')).toBeInTheDocument();
  });

  it('an empty box says no ticket found without asking the database', async () => {
    const { user } = renderPage(<TrackPage />, { path: '/track' });
    await user.click(screen.getByRole('button', { name: 'Check status' }));
    expect(await screen.findByText('No ticket found with that number.')).toBeInTheDocument();
    expect(api.trackTicket).not.toHaveBeenCalled();
  });
});

describe('Feedback: replies and escalation from staff (Module 4, UC08 and UC09)', () => {
  it('shows the team reply and that the concern went to the government, never the internal reason', async () => {
    api.trackTicket.mockResolvedValue({
      ticket_no: 'LRT-2026-0005', category: 'Road damage', location: 'Jalan A', status: 'Under review', assigned_to: 'Government Officers', escalated: true,
      history: [
        { status: 'Submitted', at: '2026-11-01T02:00:00Z', kind: 'status', note: null },
        { status: 'Submitted', at: '2026-11-02T02:00:00Z', kind: 'reply', note: 'Thanks, we have passed this on.' },
        { status: 'Submitted', at: '2026-11-02T03:00:00Z', kind: 'escalated', note: null },
      ],
    });
    renderPage(<TrackPage />, { path: '/track', at: '/track?ticket=LRT-2026-0005' });
    expect(await screen.findByText('Reply from the team')).toBeInTheDocument();
    expect(screen.getByText('Thanks, we have passed this on.')).toBeInTheDocument();
    expect(screen.getByText('Passed to the government officers')).toBeInTheDocument();
    expect(screen.getByText('This concern has been passed to the government officers.')).toBeInTheDocument();
  });
  it('still shows tickets from before replies existed (no kind in the history)', async () => {
    api.trackTicket.mockResolvedValue({ ticket_no: 'LRT-2026-0006', category: 'Noise', location: null, status: 'Submitted', assigned_to: null, history: [{ status: 'Submitted', at: '2026-11-01T02:00:00Z' }] });
    renderPage(<TrackPage />, { path: '/track', at: '/track?ticket=LRT-2026-0006' });
    expect(await screen.findByRole('heading', { name: 'LRT-2026-0006' })).toBeInTheDocument();
    expect(screen.getAllByText('Submitted').length).toBeGreaterThan(1);
  });
});
