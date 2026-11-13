// The whole app with its real routes, header and staff sign-in (Module 4, UC01).
// The database is faked: sign-in answers come from the mocked admin api, and the session events from the fake client.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fake } from './helpers/fakeSupabase.js';

vi.mock('../../src/shared/supabase.js', async (orig) => {
  const { fake: f } = await import('./helpers/fakeSupabase.js');
  const { SAMPLE_ZONES: z } = await import('./helpers/render.jsx');
  return { ...(await orig()), sb: f.sb, listZones: async () => z };
});
vi.mock('../../src/modules/admin/api.js', () => ({
  signIn: vi.fn(), signOut: vi.fn(async () => {}), myProfile: vi.fn(async () => null),
  signUp: vi.fn(), listTickets: vi.fn(async () => []), updateTicket: vi.fn(),
  listStaff: vi.fn(async () => []), getTicket: vi.fn(async () => null), ticketPhotoUrl: vi.fn(),
  listTicketEvents: vi.fn(async () => []), listAccounts: vi.fn(async () => []), setAccount: vi.fn(),
}));
vi.mock('../../src/modules/advisories/api.js', async (orig) => ({
  ...(await orig()),
  listAdvisories: vi.fn(async () => []), listUrgent: vi.fn(async () => []), listSchedule: vi.fn(async () => []),
  hubSummary: vi.fn(async () => ({ closures: 0, active: 0, urgent: 0, thisWeek: 0, latest: [] })),
  getAdvisory: vi.fn(async () => null), listMyAdvisories: vi.fn(async () => []),
}));

const adminApi = await import('../../src/modules/admin/api.js');
const { default: App } = await import('../../src/App.jsx');

const ADMIN = { full_name: 'Aisyah', role: 'admin' };

// Opens the app at an address, then plays the saved-session event Supabase sends on start.
async function openApp(hash, { signedInAs = null } = {}) {
  window.location.hash = hash;
  adminApi.myProfile.mockResolvedValue(signedInAs);
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(fake.authListener).toBeTypeOf('function'));
  act(() => fake.authListener('INITIAL_SESSION', signedInAs ? { user: { id: 'u1' } } : null));
  return user;
}
const header = () => screen.getByRole('banner');
// The form's button (the header has a Sign in button too, earlier on the page).
const submitBtn = () => screen.getAllByRole('button', { name: 'Sign in' }).at(-1);

beforeEach(() => { vi.clearAllMocks(); fake.authListener = null; });

describe('staff pages are protected', () => {
  it('sends a visitor from /admin to the sign-in page', async () => {
    await openApp('#/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Staff sign in' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
  });
  it('sends a visitor from /manage to the sign-in page', async () => {
    await openApp('#/manage');
    expect(await screen.findByRole('heading', { level: 1, name: 'Staff sign in' })).toBeInTheDocument();
  });
  it('shows a short wait message, not the sign-in page, while the saved session is checked', async () => {
    window.location.hash = '#/admin';
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking your sign-in');
    expect(window.location.hash).toBe('#/admin');
  });
  it('opens /admin for signed-in staff, with the staff links in the header', async () => {
    await openApp('#/admin', { signedInAs: ADMIN });
    expect(await screen.findByRole('heading', { level: 1, name: 'Operational dashboard' })).toBeInTheDocument();
    const nav = within(header()).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Admin', 'Edit map', 'Manage advisories', 'Manage staff']);
    expect(within(header()).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
  it('shows other staff only their staff pages: no public pages, no Manage staff', async () => {
    await openApp('#/admin', { signedInAs: { full_name: 'C', role: 'construction' } });
    await screen.findByRole('heading', { level: 1, name: 'Operational dashboard' });
    const nav = within(header()).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Admin', 'Edit map', 'Manage advisories']);
  });
  it('does not let a resident account into staff pages', async () => {
    await openApp('#/admin', { signedInAs: { full_name: 'R', role: 'resident' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Staff sign in' })).toBeInTheDocument();
  });
  it('sends unknown addresses to the home page', async () => {
    await openApp('#/no-such-page');
    expect(await screen.findByRole('heading', { level: 1, name: 'Know the works before you go' })).toBeInTheDocument();
  });
});

describe('sign-in form (UC01)', () => {
  it('checks both fields before sending and puts the cursor on the first problem', async () => {
    const user = await openApp('#/login');
    await screen.findByLabelText('Email');
    await user.click(submitBtn());
    expect(screen.getByText('Enter your staff email, for example name@example.com.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(adminApi.signIn).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as the field is typed in', async () => {
    const user = await openApp('#/login');
    const form = await screen.findByRole('textbox', { name: 'Email' });
    await user.click(submitBtn());
    await user.type(form, 'a');
    expect(screen.queryByText(/Enter your staff email/)).not.toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('shows and hides the password', async () => {
    const user = await openApp('#/login');
    const pw = await screen.findByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(pw).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains a wrong password in plain words and stays on the page', async () => {
    adminApi.signIn.mockRejectedValue(new Error('Invalid login credentials'));
    const user = await openApp('#/login');
    await user.type(await screen.findByLabelText('Email'), 'staff@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(submitBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
    expect(window.location.hash).toBe('#/login');
  });

  it('signs staff in and returns them to the page they asked for', async () => {
    adminApi.signIn.mockResolvedValue({ user: { id: 'u1' }, session: {} });
    const user = await openApp('#/manage');
    await screen.findByRole('heading', { level: 1, name: 'Staff sign in' });
    adminApi.myProfile.mockResolvedValue(ADMIN);
    await user.type(screen.getByLabelText('Email'), '  staff@example.com ');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(submitBtn());
    expect(adminApi.signIn).toHaveBeenCalledWith('staff@example.com', 'secret');
    expect(await screen.findByRole('heading', { level: 1, name: 'Manage advisories' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/manage');
  });

  it('refuses an account without a staff role and signs it out again', async () => {
    adminApi.signIn.mockResolvedValue({ user: { id: 'u2' }, session: {} });
    const user = await openApp('#/login');
    adminApi.myProfile.mockResolvedValue({ full_name: 'R', role: 'resident' });
    await user.type(await screen.findByLabelText('Email'), 'resident@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(submitBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('This account is not a staff account.');
    expect(adminApi.signOut).toHaveBeenCalled();
  });

  it('sends staff who are already signed in straight to the dashboard', async () => {
    await openApp('#/login', { signedInAs: ADMIN });
    expect(await screen.findByRole('heading', { level: 1, name: 'Operational dashboard' })).toBeInTheDocument();
  });
});

describe('header', () => {
  it('Sign in opens the sign-in page', async () => {
    const user = await openApp('#/');
    await user.click(within(header()).getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Staff sign in' })).toBeInTheDocument();
  });
  it('Sign out ends the session and goes home', async () => {
    const user = await openApp('#/admin', { signedInAs: ADMIN });
    await user.click(await within(header()).findByRole('button', { name: 'Sign out' }));
    expect(adminApi.signOut).toHaveBeenCalled();
    act(() => fake.authListener('SIGNED_OUT', null));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(await within(header()).findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(within(header()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
  // Signing out while on a staff page must go home, not to the sign-in page. jsdom cannot reproduce the browser's
  // timing for that bug, so tests/e2e/staff.spec.js ("Sign out ends the session...") guards it instead.
  it('the phone menu button opens and closes the menu, and Escape closes it', async () => {
    const user = await openApp('#/');
    const btn = within(header()).getByRole('button', { name: 'Menu' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('site-menu')).toHaveClass('open');
    await user.keyboard('{Escape}');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
  it('closes the phone menu after moving to another page', async () => {
    const user = await openApp('#/');
    const btn = within(header()).getByRole('button', { name: 'Menu' });
    await user.click(btn);
    await user.click(within(header()).getByRole('link', { name: 'Schedule' }));
    await waitFor(() => expect(btn).toHaveAttribute('aria-expanded', 'false'));
  });
  it('shows the logo with the site name in the header and footer', async () => {
    await openApp('#/');
    expect(screen.getAllByRole('link', { name: 'MutiaraInfo, home' })).toHaveLength(2);
  });
});
