// Module 1: the place of an advisory on the map (feat/advisory-map-location).
// The advisories here are fake replies, so the tests do not depend on what is in the database or change it.
import { test, expect, open, fakeSignIn } from './helpers.js';

const PINNED = {
  id: 9001, title: 'Lane closure near Komtar', body: 'One lane closed for piling.', category: 'Road closure',
  status: 'Ongoing', severity: 'Medium', state: 'Published', location: 'Jalan Penang', lat: 5.4143, lng: 100.3297,
  starts_on: '2026-11-01', ends_on: '2099-12-31', work_hours: '9 am to 5 pm', detour: null, affected_businesses: null,
  photo_paths: [], zone_id: null, zones: null, created_by: '00000000-0000-4000-8000-000000000001',
  created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
};

// A pretend advisories table holding `rows`. Returns the bodies of the saves it received.
async function fakeAdvisories(page, rows) {
  const saves = [];
  await page.route('**/rest/v1/updates*', async (r) => {
    const req = r.request();
    const one = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (req.method() === 'GET') return r.fulfill({ json: one ? rows[0] || null : rows });
    const body = req.postDataJSON();
    saves.push(body);
    return r.fulfill({ status: req.method() === 'POST' ? 201 : 200, json: { ...PINNED, id: 9002, ...body } });
  });
  return saves;
}

test('the advisory page shows where the works are, and opens the full map at that spot', async ({ page, errors }) => {
  await fakeAdvisories(page, [PINNED]);
  await open(page, `/advisories/${PINNED.id}`);
  await expect(page.getByRole('heading', { name: 'Where the works are' })).toBeVisible();
  await expect(page.getByRole('region', { name: /Map showing where the works are/ }).locator('.mpin-spot')).toBeVisible();
  await page.getByRole('link', { name: 'View on the full disruption map' }).click();
  await expect(page).toHaveURL(/#\/map\?at=5\.4143%2C100\.3297/);
  await expect(page.getByRole('heading', { name: 'Jalan Penang', level: 3 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the full advisory' })).toBeVisible();
  void errors;
});

test('staff drop a pin on the map when posting an advisory', async ({ page, errors }) => {
  await fakeSignIn(page, 'construction');
  const saves = await fakeAdvisories(page, []);
  await open(page, '/login');
  await page.locator('main form').getByLabel('Email').fill('staff@example.com');
  await page.locator('main form').getByLabel('Password').fill('correct-password');
  await page.locator('main form').getByRole('button', { name: 'Sign in' }).click();
  await page.goto('./#/manage');
  await page.getByRole('button', { name: '+ New advisory' }).click();
  await page.getByLabel(/^Title/).fill('Lane closure near Komtar');
  const map = page.getByRole('region', { name: /Map for placing the works location/ });
  await expect(page.getByText('No pin yet. Click the map where the works are.')).toBeVisible();
  await map.click({ position: { x: 150, y: 120 } });
  await expect(map.locator('.mpin-spot')).toBeVisible();
  await expect(page.getByText(/^Pin at 5\.\d+, 100\.\d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Save as draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  expect(saves[0].lat).toBeGreaterThan(5);
  expect(saves[0].lng).toBeGreaterThan(100);
  void errors;
});
