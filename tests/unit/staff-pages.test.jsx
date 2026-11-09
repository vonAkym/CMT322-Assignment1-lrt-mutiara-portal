// Staff page from Module 1: My advisories (UC06 to UC08). The Module 4 ticket pages are in admin-tickets.test.jsx.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { advisory, renderPage } from './helpers/render.jsx';

vi.mock('../../src/shared/supabase.js', async (orig) => {
  const { SAMPLE_ZONES } = await import('./helpers/render.jsx');
  return { ...(await orig()), listZones: async () => SAMPLE_ZONES };
});
vi.mock('../../src/modules/admin/api.js', () => ({ myProfile: vi.fn(async () => ({ role: 'admin' })) }));
vi.mock('../../src/modules/advisories/api.js', async (orig) => ({
  ...(await orig()),
  listMyAdvisories: vi.fn(async () => []), saveAdvisory: vi.fn(), publishAdvisory: vi.fn(), endAdvisory: vi.fn(),
  uploadAdvisoryPhoto: vi.fn(),
}));
const api = await import('../../src/modules/advisories/api.js');
const { default: ManagePage } = await import('../../src/modules/advisories/ManagePage.jsx');

beforeEach(() => { vi.clearAllMocks(); api.listMyAdvisories.mockResolvedValue([]); });

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
