// Staff pages from Module 1: Manage advisories (the list, UC07 and UC08) and the advisory form on its own page
// (New advisory UC06, Edit advisory UC07). The Module 4 ticket pages are in admin-tickets.test.jsx.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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
  listMyAdvisories: vi.fn(async () => []), getAdvisory: vi.fn(), saveAdvisory: vi.fn(), publishAdvisory: vi.fn(),
  endAdvisory: vi.fn(), uploadAdvisoryPhoto: vi.fn(),
}));
vi.mock('../../src/modules/advisories/AdvisoryMap.jsx', async (orig) => ({ ...(await orig()), LocationPicker: () => null }));
const api = await import('../../src/modules/advisories/api.js');
const { default: ManagePage } = await import('../../src/modules/advisories/ManagePage.jsx');
const { default: AdvisoryFormPage } = await import('../../src/modules/advisories/AdvisoryFormPage.jsx');

beforeEach(() => { vi.clearAllMocks(); api.listMyAdvisories.mockResolvedValue([]); signedIn.profile = { role: 'construction' }; });

// The form pages. Saving or cancelling goes to the list at /manage.
const newForm = () => renderPage(<AdvisoryFormPage />, { path: '/manage/new', others: ['/manage'] });
const editForm = (a) => {
  api.getAdvisory.mockResolvedValue(a);
  return renderPage(<AdvisoryFormPage />, { path: '/manage/:id/edit', at: `/manage/${a.id}/edit`, others: ['/manage'] });
};
const where = () => screen.getByTestId('where');

describe('Manage advisories: the list', () => {
  it('New advisory and Edit open the form on its own page', async () => {
    api.listMyAdvisories.mockResolvedValue([advisory({ id: 4, title: 'Piling', created_by: 'u1' })]);
    const { user } = renderPage(<ManagePage />, { path: '/manage', others: ['/manage/new', '/manage/:id/edit'] });
    expect(screen.getByRole('link', { name: '+ New advisory' })).toHaveAttribute('href', '/manage/new');
    await user.click(await screen.findByRole('button', { name: 'Edit: Piling' }));
    expect(where()).toHaveTextContent('/manage/4/edit');
  });

  it('shows what the form saved, on the tab it was saved to', async () => {
    api.listMyAdvisories.mockResolvedValue([advisory({ id: 5, title: 'Lane closure', state: 'Draft' })]);
    renderPage(<ManagePage />, { path: '/manage', at: { pathname: '/manage', state: { ok: 'Draft saved: Lane closure', tab: 'Draft' } } });
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved: Lane closure');
    expect(screen.getByRole('button', { name: /Drafts/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('button', { name: 'Publish: Lane closure' })).toBeInTheDocument();
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

describe('Advisory form: checks before saving', () => {
  const saveDraft = () => screen.getByRole('button', { name: /Save as draft/ });

  it('checks the title and start date before saving', async () => {
    const { user } = newForm();
    const title = screen.getByLabelText(/^Title/);
    await user.clear(screen.getByLabelText(/^Start date/));
    await user.click(saveDraft());
    expect(screen.getByText('Enter a title of 3 to 150 characters.')).toBeInTheDocument();
    expect(screen.getByText('Choose the start date.')).toBeInTheDocument();
    expect(title).toHaveFocus();
    expect(api.saveAdvisory).not.toHaveBeenCalled();
  });

  it('clears each error as soon as it is fixed (fix/advisory-form-errors)', async () => {
    const { user } = newForm();
    await user.click(saveDraft());
    expect(screen.getByText('Enter a title of 3 to 150 characters.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    expect(screen.queryByText('Enter a title of 3 to 150 characters.')).not.toBeInTheDocument();
  });

  it('refuses an end date before the start date', async () => {
    const { user } = newForm();
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    const start = screen.getByLabelText(/^Start date/);
    await user.clear(start); await user.type(start, '2026-12-10');
    await user.type(screen.getByLabelText(/^End date/), '2026-12-01');
    await user.click(saveDraft());
    expect(screen.getByText('The end date must be on or after the start date.')).toBeInTheDocument();
    expect(api.saveAdvisory).not.toHaveBeenCalled();
  });

  it('saves a valid draft and goes back to the list, saying what was saved', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 50, state: 'Draft', title: 'Lane closure' }));
    const { user } = newForm();
    expect(screen.getByLabelText(/^Title/)).toHaveFocus();
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    await user.click(saveDraft());
    await waitFor(() => expect(where()).toHaveTextContent(/^\/manage$/));
    const [id, fields] = api.saveAdvisory.mock.calls[0];
    expect(id).toBeFalsy();
    expect(fields).toMatchObject({ title: 'Lane closure', state: 'Draft' });
  });
});

describe('Advisory form: editing', () => {
  it('opens the saved advisory, and saving keeps it published', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 4, title: 'Piling works' }));
    const { user } = editForm(advisory({ id: 4, title: 'Piling', created_by: 'u1' }));
    expect(await screen.findByLabelText(/^Title/)).toHaveValue('Piling');
    expect(screen.queryByRole('button', { name: /Save as draft/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Title/), ' works');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(where()).toHaveTextContent(/^\/manage$/));
    expect(api.saveAdvisory).toHaveBeenCalledWith(4, expect.objectContaining({ title: 'Piling works', state: 'Published' }));
  });

  it('other staff cannot open someone else’s advisory; admins can', async () => {
    const theirs = advisory({ id: 6, title: 'Colleague works', created_by: 'u2' });
    const { unmount } = editForm(theirs);
    expect(await screen.findByText('Only the person who posted this advisory, or an admin, can change it.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
    unmount();
    signedIn.profile = { role: 'admin' };
    editForm(theirs);
    expect(await screen.findByLabelText(/^Title/)).toHaveValue('Colleague works');
  });

  it('ended advisories and missing ones cannot be edited', async () => {
    const { unmount } = editForm(advisory({ id: 7, state: 'Ended', status: 'Completed', created_by: 'u1' }));
    expect(await screen.findByText('This advisory has ended, so it can no longer be changed.')).toBeInTheDocument();
    unmount();
    api.getAdvisory.mockResolvedValue(null);
    renderPage(<AdvisoryFormPage />, { path: '/manage/:id/edit', at: '/manage/99/edit' });
    expect(await screen.findByText(/does not exist/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Manage advisories' })).toHaveAttribute('href', '/manage');
  });
});

describe('Manage advisories: who sees what (fix/access-advisories)', () => {
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

  it('puts each admin cell under its own heading', async () => {
    signedIn.profile = { role: 'admin' };
    api.listMyAdvisories.mockResolvedValue([rows[0]]);
    renderPage(<ManagePage />, { path: '/manage' });
    await screen.findByRole('button', { name: 'Edit: Mine' });
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[heads.indexOf('Posted by')]).toBe('You');
    expect(cells[heads.indexOf('Dates')]).not.toBe('You');
  });
});

describe('Advisory form: work status and unsaved changes (fix/advisory-form)', () => {
  const LEAVE = 'You have unsaved changes to this advisory. Leave without saving?';
  const answer = (yes) => vi.spyOn(window, 'confirm').mockReturnValue(yes);
  const optionsOf = (label) => [...screen.getByLabelText(label).options].map((o) => o.value);

  it('offers only Planned and Ongoing as the work status of a new advisory', () => {
    newForm();
    expect(optionsOf('Work status')).toEqual(['Planned', 'Ongoing']);
  });

  it('keeps Completed for an older advisory that already has it', async () => {
    editForm(advisory({ id: 4, title: 'Old works', status: 'Completed', created_by: 'u1' }));
    await screen.findByLabelText(/^Title/);
    expect(optionsOf('Work status')).toEqual(['Planned', 'Ongoing', 'Completed']);
    expect(screen.getByLabelText('Work status')).toHaveValue('Completed');
  });

  it('Cancel goes back to the list straight away when nothing was changed', async () => {
    const confirm = answer(true);
    const { user } = newForm();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(where()).toHaveTextContent(/^\/manage$/);
    confirm.mockRestore();
  });

  it('Cancel asks first when there are unsaved changes, and keeps them if the answer is no', async () => {
    const confirm = answer(false);
    const { user } = newForm();
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalledWith(LEAVE);
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Lane closure');
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(where()).toHaveTextContent(/^\/manage$/);
    confirm.mockRestore();
  });

  it('the back link and menu links ask first when there are unsaved changes', async () => {
    const confirm = answer(false);
    const page = <><Link to="/map">Map</Link><AdvisoryFormPage /></>;
    const { user } = renderPage(page, { path: '/manage/new', others: ['/map', '/manage'] });
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    await user.click(screen.getByRole('link', { name: 'Manage advisories' }));
    await user.click(screen.getByRole('link', { name: 'Map' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toHaveTextContent('/manage/new');
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: 'Map' }));
    expect(where()).toHaveTextContent('/map');
    confirm.mockRestore();
  });

  it('asks before the tab is closed or reloaded, only while there are unsaved changes', async () => {
    const { user } = newForm();
    const leave = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
    expect(leave()).toBe(false);
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
    expect(leave()).toBe(true);
  });

  it('opening a saved advisory is not an unsaved change', async () => {
    const confirm = answer(true);
    const { user } = editForm(advisory({ id: 4, title: 'Piling', created_by: 'u1', work_hours: '24 hours, Every day' }));
    await screen.findByLabelText(/^Title/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
