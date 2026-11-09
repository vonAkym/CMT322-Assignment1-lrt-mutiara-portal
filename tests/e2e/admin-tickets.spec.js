// Module 4 ticket screens in a real browser: dashboard list, filters, quick changes, and the ticket page.
// Uses a pretend staff account and a pretend tickets table (helpers.js), so nothing real is changed.
import { test, expect, fakeSignIn, fakeTickets } from './helpers.js';

const TICKETS = [
  { id: 1, ticket_no: 'LRT-2026-0001', category: 'Noise', description: 'Piling after 10 pm', location: 'Komtar', photo_path: null, reporter_name: 'Ali', is_anonymous: false, status: 'Submitted', priority: 'Medium', assigned_to: null, created_at: '2026-11-01T02:00:00Z' },
  { id: 2, ticket_no: 'LRT-2026-0002', category: 'Dust', description: 'Dust on parked cars', location: 'Jalan Sample', photo_path: null, reporter_name: null, is_anonymous: true, status: 'In progress', priority: 'High', assigned_to: 'Construction Team', created_at: '2026-11-03T02:00:00Z' },
  { id: 3, ticket_no: 'LRT-2026-0003', category: 'Blocked access', description: 'Shop entrance blocked by barriers', location: 'Lebuh Chulia', photo_path: null, reporter_name: 'Mei Ling', is_anonymous: false, status: 'Resolved', priority: 'Low', assigned_to: 'Ravi', created_at: '2026-11-02T02:00:00Z' },
];

let saved;
test.beforeEach(async ({ page }) => {
  await fakeSignIn(page, 'admin');
  saved = await fakeTickets(page, TICKETS);
  await page.goto('./#/login');
  const form = page.locator('main form');
  await form.getByLabel('Email').fill('staff@example.com');
  await form.getByLabel('Password').fill('correct-password');
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('h1')).toHaveText('Operational dashboard');
});

const rows = (page) => page.locator('table.tickets tbody tr');
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test('the dashboard lists the tickets, newest first, with counts', async ({ page, errors }) => {
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).first().getByRole('link')).toHaveText('LRT-2026-0002');
  await expect(page.getByRole('button', { name: /^Total/ })).toContainText('3');
  await expect(page.getByRole('button', { name: /^Resolved/ })).toContainText('1');
  void errors;
});

test('filters narrow the list, live in the address and survive a refresh', async ({ page, errors }) => {
  await page.getByLabel('Category').selectOption('Noise');
  await expect(rows(page)).toHaveCount(1);
  await expect(page).toHaveURL(/category=Noise/);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Search').fill('chulia');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('LRT-2026-0003');
  void errors;
});

test('status, priority and assignee change straight from the list', async ({ page, errors }) => {
  await page.getByLabel('Status for LRT-2026-0001').selectOption('Under review');
  await expect(page.getByText('Saved LRT-2026-0001.')).toBeVisible();
  await page.getByLabel('Priority for LRT-2026-0001').selectOption('High');
  await expect(page.getByLabel('Priority for LRT-2026-0001')).toBeEnabled();
  await page.getByLabel('Assignee for LRT-2026-0001').selectOption({ label: 'Ravi (Construction Team)' });
  await expect(page.getByLabel('Assignee for LRT-2026-0001')).toBeEnabled();
  await expect.poll(() => saved[0]).toMatchObject({ status: 'Under review', priority: 'High', assigned_to: 'Ravi' });
  await expect(page.getByRole('button', { name: /^Under review/ })).toContainText('1');
  void errors;
});

test('the ticket page shows the details and saves changes with a new history entry', async ({ page, errors }) => {
  await page.getByLabel('Status', { exact: true }).selectOption('Submitted');
  await page.getByRole('link', { name: 'LRT-2026-0001' }).click();
  await expect(page.locator('h1')).toHaveText('LRT-2026-0001');
  await expect(page.getByText('Piling after 10 pm')).toBeVisible();
  await expect(page.locator('.facts')).toContainText('Ali');
  await expect(page.locator('.thist li')).toHaveCount(1);

  await page.getByLabel('Status', { exact: true }).selectOption('In progress');
  await page.getByLabel('Assigned to').selectOption('Construction Team');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved.')).toBeVisible();
  await expect(page.locator('.thist li')).toHaveCount(2);
  await expect(page.locator('.thist li').last()).toContainText('In progress');
  expect(saved[0]).toMatchObject({ status: 'In progress', assigned_to: 'Construction Team' });

  await page.getByRole('link', { name: '← All tickets' }).click();
  await expect(page).toHaveURL(/#\/admin\?status=Submitted$/);
  void errors;
});

test('an anonymous ticket says so', async ({ page }) => {
  await page.getByRole('link', { name: 'LRT-2026-0002' }).click();
  await expect(page.locator('.facts')).toContainText('Anonymous');
  await expect(page.getByText('High priority')).toBeVisible();
});

test('an unknown ticket number says so', async ({ page }) => {
  await page.goto('./#/admin/tickets/LRT-1900-0000');
  await expect(page.locator('h1')).toHaveText('No ticket LRT-1900-0000');
});

test('the ticket page and dashboard fit the screen', async ({ page }) => {
  await page.getByRole('link', { name: 'LRT-2026-0001' }).click();
  await expect(page.locator('h1')).toHaveText('LRT-2026-0001');
  expect(await noSideScroll(page)).toBe(true);
  await page.goBack();
  await expect(rows(page)).toHaveCount(3);
  expect(await noSideScroll(page)).toBe(true);
});
