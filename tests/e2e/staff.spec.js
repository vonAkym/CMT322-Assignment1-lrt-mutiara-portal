// Module 4, UC01: staff sign-in and the staff pages.
import { test, expect, open, fakeSignIn, allow } from './helpers.js';

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
    await expect(page.locator('h1')).toHaveText('My advisories');
    await expect(page).toHaveURL(/#\/manage$/);
    await page.reload();
    await expect(page.locator('h1')).toHaveText('My advisories');
    void errors;
  });

  test('the dashboard opens after signing in, with staff links in the menu', async ({ page, errors }) => {
    await fakeSignIn(page, 'construction');
    await open(page, '/login');
    await signIn(page);
    await expect(page.locator('h1')).toHaveText('Operational dashboard');
    if (isPhone(page)) await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'My advisories' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Admin' })).toBeVisible();
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
