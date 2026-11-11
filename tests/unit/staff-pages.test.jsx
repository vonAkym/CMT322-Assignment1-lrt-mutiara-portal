// Staff page from Module 1: My advisories (UC06 to UC08). The Module 4 ticket pages are in admin-tickets.test.jsx.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Link } from 'react-router';
import { advisory, renderPage } from './helpers/render.jsx';

vi.mock('../../src/shared/supabase.js', async (orig) => {
  const { SAMPLE_ZONES } = await import('./helpers/render.jsx');
  return { ...(await orig()), listZones: async () => SAMPLE_ZONES };
});
// Who is signed in (normally from Danial's StaffProvider). Tests change the role through `signedIn`.
const signedIn = vi.hoisted(() => ({ user: { id: 'u1' }, profile: { role: 'construction' } }));
vi.mock('../../src/shared/staff.jsx', () => ({ useStaff: () => signedIn }));
vi.mock('../../src/modules/advisories/api.js', async (orig) => ({
  ...(await orig()),
  listMyAdvisories: vi.fn(async () => []), saveAdvisory: vi.fn(), publishAdvisory: vi.fn(), endAdvisory: vi.fn(),
  uploadAdvisoryPhoto: vi.fn(),
}));
const api = await import('../../src/modules/advisories/api.js');
const { default: ManagePage } = await import('../../src/modules/advisories/ManagePage.jsx');

beforeEach(() => { vi.clearAllMocks(); api.listMyAdvisories.mockResolvedValue([]); signedIn.profile = { role: 'construction' }; });

describe('My advisories: the advisory form', () => {
  const openForm = async (user) => {
    await user.click(screen.getByRole('button', { name: '+ New advisory' }));
    return screen.getByLabelText(/^Title/);
  };
  const saveDraft = () => screen.getByRole('button', { name: /Save as draft/ });

  it('checks the title and start date before saving', async () => {
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    const title = await openForm(user);
    await user.clear(screen.getByLabelText(/^Start date/));
    await user.click(saveDraft());
    expect(screen.getByText('Enter a title of 3 to 150 characters.')).toBeInTheDocument();
    expect(screen.getByText('Choose the start date.')).toBeInTheDocument();
    expect(title).toHaveFocus();
    expect(api.saveAdvisory).not.toHaveBeenCalled();
  });

  it('clears each error as soon as it is fixed (fix/advisory-form-errors)', async () => {
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    const title = await openForm(user);
    await user.click(saveDraft());
    expect(screen.getByText('Enter a title of 3 to 150 characters.')).toBeInTheDocument();
    await user.type(title, 'Lane closure');
    expect(screen.queryByText('Enter a title of 3 to 150 characters.')).not.toBeInTheDocument();
  });

  it('refuses an end date before the start date', async () => {
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    const title = await openForm(user);
    await user.type(title, 'Lane closure');
    const start = screen.getByLabelText(/^Start date/);
    await user.clear(start); await user.type(start, '2026-12-10');
    await user.type(screen.getByLabelText(/^End date/), '2026-12-01');
    await user.click(saveDraft());
    expect(screen.getByText('The end date must be on or after the start date.')).toBeInTheDocument();
    expect(api.saveAdvisory).not.toHaveBeenCalled();
  });

  it('saves a valid draft', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 50, state: 'Draft', title: 'Lane closure' }));
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    const title = await openForm(user);
    await user.type(title, 'Lane closure');
    await user.click(saveDraft());
    await waitFor(() => expect(api.saveAdvisory).toHaveBeenCalled());
    const [id, fields] = api.saveAdvisory.mock.calls[0];
    expect(id).toBeFalsy();
    expect(fields).toMatchObject({ title: 'Lane closure', state: 'Draft' });
  });

  it('lists published advisories with View, Edit and End, and flags ones past their end date', async () => {
    api.listMyAdvisories.mockResolvedValue([
      advisory({ id: 1, title: 'Current works' }),
      advisory({ id: 2, title: 'Overdue works', starts_on: '2020-01-01', ends_on: '2020-02-01' }),
    ]);
    renderPage(<ManagePage />, { path: '/manage' });
    expect(await screen.findByRole('button', { name: 'End: Current works' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit: Current works' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View: Current works' })).toBeInTheDocument();
    expect(screen.getAllByText(/Overdue works/).length).toBeGreaterThan(0);
  });
});

describe('My advisories: who sees what (fix/access-advisories)', () => {
  const rows = [
    advisory({ id: 1, title: 'Mine', created_by: 'u1', posted_by: 'Asyraf' }),
    advisory({ id: 2, title: 'Colleague', created_by: 'u2', posted_by: 'Aina' }),
    advisory({ id: 3, title: 'Sample', created_by: null, posted_by: null }),
  ];

  it('other staff get only their own advisories, without a Posted by column', async () => {
    api.listMyAdvisories.mockResolvedValue([rows[0]]);
    renderPage(<ManagePage />, { path: '/manage' });
    expect(await screen.findByRole('button', { name: 'Edit: Mine' })).toBeInTheDocument();
    expect(api.listMyAdvisories).toHaveBeenCalledWith({ all: false });
    expect(screen.queryByRole('columnheader', { name: 'Posted by' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin view/)).not.toBeInTheDocument();
  });

  it('admins get every advisory, with who posted each, and can edit and end them all', async () => {
    signedIn.profile = { role: 'admin' };
    api.listMyAdvisories.mockResolvedValue(rows);
    renderPage(<ManagePage />, { path: '/manage' });
    expect(await screen.findByRole('button', { name: 'End: Sample' })).toBeInTheDocument();
    expect(api.listMyAdvisories).toHaveBeenCalledWith({ all: true });
    expect(screen.getByRole('columnheader', { name: 'Posted by' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'You' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Aina' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Not recorded' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit: Colleague' })).toBeInTheDocument();
    expect(screen.getByText(/Admin view/)).toBeInTheDocument();
  });
});

describe('My advisories: work status and unsaved changes (fix/advisory-form)', () => {
  const LEAVE = 'You have unsaved changes to this advisory. Leave without saving?';
  const answer = (yes) => vi.spyOn(window, 'confirm').mockReturnValue(yes);
  const optionsOf = (label) => [...screen.getByLabelText(label).options].map((o) => o.value);

  it('offers only Planned and Ongoing as the work status of a new advisory', async () => {
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await user.click(screen.getByRole('button', { name: '+ New advisory' }));
    expect(optionsOf('Work status')).toEqual(['Planned', 'Ongoing']);
  });

  it('keeps Completed for an older advisory that already has it', async () => {
    api.listMyAdvisories.mockResolvedValue([advisory({ id: 4, title: 'Old works', status: 'Completed' })]);
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await user.click(await screen.findByRole('button', { name: 'Edit: Old works' }));
    expect(optionsOf('Work status')).toEqual(['Planned', 'Ongoing', 'Completed']);
    expect(screen.getByLabelText('Work status')).toHaveValue('Completed');
  });

  it('Cancel closes straight away when nothing was changed', async () => {
    const confirm = answer(true);
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await user.click(screen.getByRole('button', { name: '+ New advisory' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('Cancel asks first when there are unsaved changes, and keeps them if the answer is no', async () => {
    const confirm = answer(false);
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await user.click(screen.getByRole('button', { name: '+ New advisory' }));
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalledWith(LEAVE);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Lane closure');
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('a menu link asks first when there are unsaved changes', async () => {
    const confirm = answer(false);
    const page = <><Link to="/map">Map</Link><ManagePage /></>;
    const { user } = renderPage(page, { path: '/manage', others: ['/map'] });
    await user.click(screen.getByRole('button', { name: '+ New advisory' }));
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    await user.click(screen.getByRole('link', { name: 'Map' }));
    expect(confirm).toHaveBeenCalledWith(LEAVE);
    expect(screen.getByTestId('where')).toHaveTextContent('/manage');
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: 'Map' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/map');
    confirm.mockRestore();
  });

  it('asks before the tab is closed or reloaded, only while there are unsaved changes', async () => {
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    const leave = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
    await user.click(screen.getByRole('button', { name: '+ New advisory' }));
    expect(leave()).toBe(false);
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    expect(leave()).toBe(true);
  });
});
