// Finishing Module 4, in a real browser: roles (Figure 4), area and response figures (UC10), the report download
// (UC11), Manage staff roles (UC12), and the area on the Report form. Pretend accounts and tickets (helpers.js),
// so nothing real is changed.
import { readFile } from 'node:fs/promises';
import { test, expect, fakeSignIn, fakeTickets, fakeAccounts, fakeWrites } from './helpers.js';

const TICKETS = [
  { id: 1, ticket_no: 'LRT-2026-0001', category: 'Noise', description: 'Piling after 10 pm', location: 'Komtar', photo_path: null, reporter_name: 'Ali', is_anonymous: false, status: 'Submitted', priority: 'Medium', assigned_to: null, escalated_at: null, zone_id: null, created_at: '2026-11-01T02:00:00Z' },
  { id: 2, ticket_no: 'LRT-2026-0002', category: 'Dust', description: 'Dust on parked cars', location: 'Jalan Sample', photo_path: null, reporter_name: null, is_anonymous: true, status: 'Submitted', priority: 'High', assigned_to: 'Construction Team', escalated_at: null, zone_id: null, created_at: '2026-11-03T02:00:00Z' },
];

async function signInAs(page, role, name) {
  await fakeSignIn(page, role, name);
  const saved = await fakeTickets(page, TICKETS);
  await page.goto('./#/login');
  const form = page.locator('main form');
  await form.getByLabel('Email').fill('staff@example.com');
  await form.getByLabel('Password').fill('correct-password');
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('h1')).toHaveText('Operational dashboard');
  return saved;
}

test('the Construction Team can only work on its own tickets', async ({ page, errors }) => {
  const saved = await signInAs(page, 'construction', 'Ravi');
  await expect(page.getByText(/As Construction Team you can change the status/)).toBeVisible();
  await expect(page.getByLabel('Status for LRT-2026-0001')).toBeDisabled();
  await expect(page.getByLabel('Priority for LRT-2026-0002')).toBeDisabled();
  await page.getByLabel('Status for LRT-2026-0002').selectOption('In progress');
  await expect(page.getByText('Saved LRT-2026-0002.')).toBeVisible();
  expect(saved[1].status).toBe('In progress');

  await page.getByRole('link', { name: 'LRT-2026-0001' }).click();
  await expect(page.getByText(/read-only for you/)).toBeVisible();
  await expect(page.getByText('Only an admin can escalate a ticket.')).toBeVisible();
  void errors;
});

test('response figures update after the first status change (UC10)', async ({ page, errors }) => {
  await signInAs(page, 'admin', 'Aisyah');
  const waiting = page.locator('.stats .card', { hasText: 'Waiting for a first response' });
  await expect(waiting).toContainText('2');
  await page.getByLabel('Status for LRT-2026-0001').selectOption('Under review');
  await expect(waiting).toContainText('1');
  await expect(page.locator('.stats .card', { hasText: 'Average first response' })).toContainText('over 1 answered ticket');
  void errors;
});

test('the report downloads as a CSV file with the figures and tickets (UC11)', async ({ page, errors }) => {
  await signInAs(page, 'admin', 'Aisyah');
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download report (CSV)' }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/^mutiarainfo-tickets-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await readFile(await file.path(), 'utf8');
  expect(text).toContain('MutiaraInfo ticket summary report');
  expect(text).toContain('LRT-2026-0001');
  expect(text).toContain('LRT-2026-0002');
  void errors;
});

test('an admin gives a new account a staff role and name (UC12)', async ({ page, errors }) => {
  await signInAs(page, 'admin', 'Test Staff');
  const accounts = await fakeAccounts(page, [
    { id: '00000000-0000-4000-8000-000000000001', email: 'staff@example.com', full_name: 'Test Staff', role: 'admin', created_at: '2026-11-01T00:00:00Z' },
    { id: 'new', email: 'new@example.com', full_name: null, role: 'resident', created_at: '2026-11-03T00:00:00Z' },
  ]);
  await page.getByRole('button', { name: 'Manage staff roles' }).click();
  await expect(page.locator('h1')).toHaveText('Manage staff roles');
  await expect(page.getByLabel('Role for staff@example.com')).toBeDisabled();
  await page.getByLabel('Role for new@example.com').selectOption('Government Officer');
  await page.getByLabel('Name for new@example.com').fill('Siti');
  await page.getByRole('button', { name: 'Save new@example.com' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  expect(accounts[1]).toMatchObject({ role: 'government', full_name: 'Siti' });
  await expect(page.getByText('2 accounts, 2 with staff access')).toBeVisible();
  void errors;
});

test('Manage staff roles is refused for other staff', async ({ page }) => {
  await signInAs(page, 'government', 'Siti');
  await expect(page.getByRole('button', { name: 'Manage staff roles' })).toHaveCount(0);
  await page.goto('./#/admin/staff');
  await expect(page.getByRole('alert')).toHaveText('Only admins can manage staff roles.');
});

test('the Report form sends the chosen area with the concern', async ({ page, errors }) => {
  await fakeWrites(page);
  let sent;
  await page.route('**/rest/v1/rpc/submit_ticket', async (r) => { sent = r.request().postDataJSON(); await r.fulfill({ json: 'LRT-2099-0003' }); });
  await page.goto('./#/report');
  await page.getByLabel('Describe the issue').fill('Blocked entrance to my shop');
  const area = page.getByLabel('Area (optional)');
  await expect(area.locator('option')).not.toHaveCount(1); // the areas have loaded
  await area.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Submit concern' }).click();
  await expect(page.getByText('LRT-2099-0003')).toBeVisible();
  expect(sent.p_zone_id).toBeGreaterThan(0);
  void errors;
});
