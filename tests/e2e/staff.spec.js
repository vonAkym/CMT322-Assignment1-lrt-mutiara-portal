// Module 4, UC01: staff sign-in and the staff pages.
import { test, expect, open, fakeSignIn, fakeAccounts, allow } from './helpers.js';

// The sign-in page logs refused sign-ins to the console (like every failed request on the site), and the browser
// logs the refused HTTP 400. Both are expected in the tests where refusing is the point.
const REFUSED = [/status of 400/, /Invalid login credentials/, /not a staff account/];

const form = (page) => page.locator('main form');
const header = (page) => page.locator('header.top');
const isPhone = (page) => page.viewportSize().width < 600;

async function signIn(page, password = 'correct-password') {
  await form(page).getByLabel('Email').fill('staff@example.com');
  await form(page).getByLabel('Password').fill(password);
  await form(page).getByRole('button', { name: 'Sign in' }).click();
}

test('staff pages send visitors to the sign-in page', async ({ page, errors }) => {
  for (const path of ['/admin', '/manage']) {
    await page.goto(`./#${path}`);
    await expect(page.locator('h1')).toHaveText('Staff sign in');
    await expect(page).toHaveURL(/#\/login$/);
  }
  void errors;
});

test('a wrong password is refused by the real Supabase project', async ({ page, errors }) => {
  await open(page, '/login');
  await form(page).getByLabel('Email').fill('nobody@example.com');
  await form(page).getByLabel('Password').fill('wrong-password-123');
  await form(page).getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password. Please check them and try again.');
  allow(errors, ...REFUSED);
});

test('the form checks the fields before sending', async ({ page }) => {
  await open(page, '/login');
  await form(page).getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your staff email, for example name@example.com.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  await expect(form(page).getByLabel('Email')).toBeFocused();
});

test.describe('with a pretend staff account', () => {
  test('signs in, returns to the page asked for, and stays signed in after a refresh', async ({ page, errors }) => {
    await fakeSignIn(page, 'admin');
    await page.goto('./#/manage');
    await expect(page.locator('h1')).toHaveText('Staff sign in');
    await signIn(page);
    await expect(page.locator('h1')).toHaveText('Manage advisories');
    await expect(page).toHaveURL(/#\/manage$/);
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Manage advisories');
    void errors;
  });

  test('the dashboard opens after signing in, with staff links in the menu', async ({ page, errors }) => {
    await fakeSignIn(page, 'construction');
    await open(page, '/login');
    await signIn(page);
    await expect(page.locator('h1')).toHaveText('Operational dashboard');
    if (isPhone(page)) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Manage advisories' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Construction', exact: true })).toBeVisible(); // named after the role
    await expect(nav.getByRole('link', { name: 'Edit map' })).toBeVisible();
    // Staff see the staff pages only; Manage staff is for admins.
    await expect(nav.getByRole('link', { name: 'Advisories', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Manage staff' })).toHaveCount(0);
    void errors;
  });

  test('admins also get Manage staff, and only it is marked on that page', async ({ page, errors }) => {
    await fakeSignIn(page, 'admin');
    await fakeAccounts(page, [{ id: '00000000-0000-4000-8000-000000000001', email: 'staff@example.com', full_name: 'Test Staff', role: 'admin', created_at: '2026-11-01T00:00:00Z' }]);
    await open(page, '/login');
    await signIn(page);
    await expect(page.locator('h1')).toHaveText('Operational dashboard');
    if (isPhone(page)) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('link', { name: 'Manage staff' }).click();
    await expect(page).toHaveURL(/#\/admin\/staff$/);
    await expect(page.getByLabel('Role for staff@example.com')).toBeVisible();
    if (isPhone(page)) await page.getByRole('button', { name: 'Menu' }).click();
    await expect(nav.getByRole('link', { name: 'Manage staff' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Admin', exact: true })).not.toHaveAttribute('aria-current', 'page');
    void errors;
  });

  test('Sign out ends the session and locks the staff pages again', async ({ page, errors }) => {
    await fakeSignIn(page, 'admin');
    await open(page, '/login');
    await signIn(page);
    await expect(page.locator('h1')).toHaveText('Operational dashboard');
    await header(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(header(page).getByRole('button', { name: 'Sign in' })).toBeVisible();
    await page.goto('./#/admin');
    await expect(page.locator('h1')).toHaveText('Staff sign in');
    void errors;
  });

  test('an account without a staff role is refused', async ({ page, errors }) => {
    await fakeSignIn(page, 'resident');
    await open(page, '/login');
    await signIn(page);
    await expect(page.getByRole('alert')).toHaveText(/This account is not a staff account/);
    await page.goto('./#/admin');
    await expect(page.locator('h1')).toHaveText('Staff sign in');
    allow(errors, ...REFUSED);
  });

  test('a wrong password gets the plain-words message', async ({ page, errors }) => {
    await fakeSignIn(page, 'admin');
    await open(page, '/login');
    await signIn(page, 'nope');
    await expect(page.getByRole('alert')).toHaveText('Wrong email or password. Please check them and try again.');
    allow(errors, ...REFUSED);
  });
});
