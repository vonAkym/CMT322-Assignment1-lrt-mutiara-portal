// Every page opens, shows its heading, logs no errors and fits the screen (desktop and phone).
import { test, expect, open, overflows } from './helpers.js';

const PAGES = [
  ['/', 'Know the works before you go'],
  ['/advisories', 'Every works notice on the line'],
  ['/schedule', 'What runs when, area by area'],
  ['/map', 'Construction and disruption map'],
  ['/report', 'Report a concern'],
  ['/track', 'Feedback and ticket tracking'],
  ['/login', 'Staff sign in'],
  ['/landing', 'Landing page alternatives'],
  ['/landing/a', null],
  ['/landing/b', null],
  ['/landing/c', null],
  ['/landing/d', 'Know the works before you go'],
];

for (const [path, title] of PAGES) {
  test(`${path} opens cleanly`, async ({ page, errors }) => {
    await open(page, path);
    if (title) await expect(page.locator('h1').first()).toHaveText(title);
    await page.waitForLoadState('networkidle');
    expect(await overflows(page), 'page scrolls sideways').toBe(false);
    void errors;
  });
}

test('an advisory detail page opens from its address', async ({ page, errors }) => {
  await open(page, '/advisories');
  const first = page.locator('.acard-link').first();
  const [href, title] = [await first.getAttribute('href'), await first.textContent()];
  await page.goto(`./${href}`);
  await expect(page.locator('h1')).toHaveText(title);
  await expect(page.getByRole('heading', { name: 'Key facts' })).toBeVisible();
  expect(await overflows(page)).toBe(false);
  void errors;
});

test('the site name and logo are in the header and footer', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('link', { name: 'MutiaraInfo, home' })).toHaveCount(2);
  await expect(page.locator('header.top .logo-name')).toHaveText('MutiaraInfo');
});

test('the site uses the Outfit font and the green header', async ({ page }) => {
  await open(page, '/');
  const font = await page.locator('h1').evaluate((h) => getComputedStyle(h).fontFamily);
  expect(font).toContain('Outfit');
  const bg = await page.locator('header.top').evaluate((h) => getComputedStyle(h).backgroundColor);
  expect(bg).toBe('rgb(12, 59, 46)'); // #0C3B2E
});

test('dark mode gives the pages a dark background', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, '/advisories');
  const bg = await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);
  const [r, g, bl] = bg.match(/\d+/g).map(Number);
  expect(r + g + bl).toBeLessThan(150);
});
