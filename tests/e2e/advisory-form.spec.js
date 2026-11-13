// Module 1: the advisory form on its own page (feat/advisory-form-page): #/manage/new and #/manage/:id/edit.
// The advisories here are fake replies, so the tests do not depend on what is in the database or change it.
import { test, expect, fakeSignIn, fakeAdvisories, signInAsStaff } from './helpers.js';

const MINE = {
  id: 9004, title: 'Barrier works', body: 'Barriers are moved.', category: 'Road closure', status: 'Ongoing',
  severity: 'Low', state: 'Published', location: 'Jalan Penang', lat: null, lng: null, starts_on: '2026-11-01',
  ends_on: '2099-12-31', work_hours: null, detour: null, affected_businesses: null, photo_paths: [], zone_id: null,
  zones: null, created_by: '00000000-0000-4000-8000-000000000001', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
};

test('Edit opens the form on its own page, and saving returns to the list', async ({ page, errors }) => {
  await fakeSignIn(page, 'construction');
  const saves = await fakeAdvisories(page, [MINE], MINE);
  await signInAsStaff(page);
  await page.goto('./#/manage');
  await expect(page.locator('h1')).toHaveText('Manage advisories');
  await page.getByRole('button', { name: 'Edit: Barrier works' }).click();
  await expect(page).toHaveURL(/#\/manage\/9004\/edit$/);
  await expect(page.locator('h1')).toHaveText('Edit advisory');
  await expect(page).toHaveTitle(/Edit: Barrier works/);
  await page.getByLabel(/^Title/).fill('Barrier works at night');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(/#\/manage$/);
  await expect(page.getByRole('status').filter({ hasText: 'Saved: Barrier works at night' })).toBeVisible();
  expect(saves[0].title).toBe('Barrier works at night');
  void errors;
});

test('New advisory has its own page, and the back link returns to the list', async ({ page, errors }) => {
  await fakeSignIn(page, 'construction');
  await fakeAdvisories(page, []);
  await signInAsStaff(page);
  await page.goto('./#/manage');
  await page.getByRole('link', { name: '+ New advisory' }).click();
  await expect(page).toHaveURL(/#\/manage\/new$/);
  await expect(page.locator('h1')).toHaveText('New advisory');
  await expect(page.getByLabel(/^Title/)).toBeFocused();
  await page.locator('main').getByRole('link', { name: 'Manage advisories' }).click();
  await expect(page).toHaveURL(/#\/manage$/);
  void errors;
});
