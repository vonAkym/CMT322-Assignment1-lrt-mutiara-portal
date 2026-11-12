// Module 1: work hours chosen with time pickers and day boxes (feat/work-hours).
// The advisories here are fake replies, so the tests do not depend on what is in the database or change it.
import { test, expect, open, fakeSignIn, fakeAdvisories, signInAsStaff } from './helpers.js';

const BASE = {
  id: 9003, title: 'Night barrier works', body: 'Barriers are moved at night.', category: 'Road closure',
  status: 'Ongoing', severity: 'Low', state: 'Published', location: 'Jalan Penang', lat: null, lng: null,
  starts_on: '2026-11-01', ends_on: '2099-12-31', work_hours: '24 hours, Every day', detour: null, affected_businesses: null,
  photo_paths: [], zone_id: null, zones: null, created_by: '00000000-0000-4000-8000-000000000001',
  created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
};

test('staff pick the work hours and days, and the public sees them', async ({ page, errors }) => {
  await fakeSignIn(page, 'construction');
  const saves = await fakeAdvisories(page, [], BASE);
  await signInAsStaff(page);
  await page.goto('./#/manage');
  await page.getByRole('button', { name: '+ New advisory' }).click();
  await page.getByLabel(/^Title/).fill('Night barrier works');
  await page.getByLabel('Start time', { exact: true }).fill('22:00');
  await page.getByLabel('End time', { exact: true }).fill('06:00');
  await page.getByRole('button', { name: 'Mon–Sat' }).click();
  await expect(page.getByText(/Shown to the public as/)).toContainText('10:00 pm – 6:00 am, Mon–Sat (overnight');
  await page.getByRole('button', { name: 'Save as draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  expect(saves[0].work_hours).toBe('10:00 pm – 6:00 am, Mon–Sat');
  void errors;
});

test('round-the-clock works show as happening now', async ({ page, errors }) => {
  await fakeAdvisories(page, [BASE], BASE);
  await open(page, `/advisories/${BASE.id}`);
  await expect(page.getByText('Works happening now')).toBeVisible();
  await expect(page.getByText('24 hours, Every day')).toBeVisible();
  void errors;
});
