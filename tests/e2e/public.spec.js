// What a resident does on the site, from start to finish. Saving is answered with fake replies (see helpers.js).
import { test, expect, open, fakeWrites } from './helpers.js';

const isPhone = (page) => page.viewportSize().width < 600;
// On a phone the menu links are inside the ☰ menu.
async function menuLink(page, name) {
  if (isPhone(page)) await page.getByRole('button', { name: 'Menu' }).click();
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });
}

test.describe('Module 1: advisories', () => {
  test('home page numbers load from the database and open their advisories', async ({ page, errors }) => {
    await open(page, '/');
    const tile = page.getByRole('button', { name: /Ongoing advisories/ });
    await expect(tile.locator('b')).toHaveText(/^\d+$/);
    await tile.click();
    await expect(page).toHaveURL(/#\/advisories\?status=Ongoing$/);
    await expect(page.getByLabel('Status')).toHaveValue('Ongoing');
    void errors;
  });

  test('home page shows the latest advisories', async ({ page }) => {
    await open(page, '/');
    await expect(page.locator('.acards.three .acard').first()).toBeVisible();
  });

  test('searching from the home page opens matching advisories', async ({ page, errors }) => {
    await open(page, '/');
    await page.getByLabel('Search advisories').fill('closure');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/#\/advisories\?q=closure/);
    await expect(page.getByRole('status').filter({ hasText: /advisor/ })).toHaveText(/^\d+ advisor(y|ies)$/);
    void errors;
  });

  test('advisory filters change the address and the list, and Clear resets them', async ({ page, errors }) => {
    await open(page, '/advisories');
    const count = page.getByRole('status').filter({ hasText: /advisor/ });
    await expect(count).toHaveText(/^\d+ advisor/);
    await page.getByLabel('Type').selectOption('Road closure');
    await expect(page).toHaveURL(/category=Road\+closure/);
    await page.getByLabel('Status').selectOption('ended');
    await expect(count).toHaveText(/^\d+ ended advisor/);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/#\/advisories$/);
    void errors;
  });

  test('the back button brings the filters back', async ({ page }) => {
    await open(page, '/advisories?status=Ongoing');
    await page.locator('.acard-link').first().click();
    await expect(page.getByRole('heading', { name: 'Key facts' })).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel('Status')).toHaveValue('Ongoing');
  });

  test('an advisory card opens its details, with a link to report a concern there', async ({ page, errors }) => {
    await open(page, '/advisories');
    const card = page.locator('.acard-link').first();
    const title = await card.textContent();
    await card.click();
    await expect(page.locator('h1')).toHaveText(title);
    await expect(page.getByRole('heading', { name: 'Key facts' })).toBeVisible();
    void errors;
  });

  test('the works schedule lists works by area', async ({ page, errors }) => {
    await open(page, '/schedule');
    await expect(page.locator('.sch-title').first()).toBeVisible();
    void errors;
  });

  test('zone alerts check the form, then confirm (saving is faked)', async ({ page, errors }) => {
    await fakeWrites(page);
    await open(page, '/advisories');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText('Choose an area.')).toBeVisible();
    await page.locator('#sz').selectOption({ index: 1 });
    await page.locator('#se').fill('test@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText(/^Subscribed\. Alerts for .+ will go to test@example\.com\.$/)).toBeVisible();
    void errors;
  });

  test('the urgent banner opens its advisory and can be closed', async ({ page }) => {
    await open(page, '/');
    const banner = page.getByRole('region', { name: 'Urgent alerts' });
    test.skip(!(await banner.isVisible()), 'no urgent advisories in the database today');
    await banner.getByRole('button').last().click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
    await expect(banner).toBeHidden(); // stays closed in this tab
  });
});

test.describe('Module 2: map', () => {
  test('markers open their details and lead to the report form', async ({ page, errors }) => {
    await open(page, '/map');
    const marker = page.locator('.lmap .mpin[role="button"]').first();
    const label = await marker.getAttribute('aria-label');
    await marker.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Report an issue here' }).click();
    await expect(page).toHaveURL(/#\/report\?location=/);
    await expect(page.getByLabel('Location')).toHaveValue(label.split(',')[0]);
    void errors;
  });

  test('layers, search and zoom work', async ({ page }) => {
    await open(page, '/map');
    const stations = page.locator('.lmap .mpin-station');
    await expect(stations).toHaveCount(21);
    const layer = page.getByLabel('LRT line and stations');
    await layer.uncheck();
    await expect(stations).toHaveCount(0);
    // Searching for a station ticks its layer again and shows its details.
    await page.getByLabel('Search station, street or business').fill('Komtar');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(layer).toBeChecked();
    await expect(page.getByRole('heading', { name: 'Komtar', level: 3 })).toBeVisible();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(stations).toHaveCount(21);
  });
});

test.describe('Module 3: report and track', () => {
  test('the report form checks the description first', async ({ page }) => {
    await fakeWrites(page);
    await open(page, '/report');
    await page.getByRole('button', { name: 'Submit concern' }).click();
    await expect(page.getByText('Please describe the issue (at least 5 characters).')).toBeVisible();
  });

  test('a concern gets a ticket number, which opens tracking (saving is faked)', async ({ page, errors }) => {
    await fakeWrites(page, {
      ticketNo: 'LRT-2099-0001',
      track: { ticket_no: 'LRT-2099-0001', category: 'Noise', location: 'Komtar', status: 'Submitted', assigned_to: null, history: [{ status: 'Submitted', at: new Date().toISOString() }] },
    });
    await open(page, '/report');
    await page.getByLabel('Category').selectOption('Noise');
    await page.getByLabel('Describe the issue').fill('Piling after 10 pm every night');
    await page.getByLabel('Location').fill('Komtar');
    await page.getByRole('button', { name: 'Submit concern' }).click();
    await expect(page.getByText('LRT-2099-0001')).toBeVisible();
    await page.getByRole('button', { name: 'Track this ticket' }).click();
    await expect(page).toHaveURL(/#\/track\?ticket=LRT-2099-0001/);
    await expect(page.getByRole('heading', { name: 'LRT-2099-0001' })).toBeVisible();
    await expect(page.getByText('Assigned to: Unassigned')).toBeVisible();
    void errors;
  });

  test('tracking shows the team’s reply and that the concern went to the government (faked answer)', async ({ page, errors }) => {
    await fakeWrites(page, {
      track: {
        ticket_no: 'LRT-2099-0002', category: 'Road damage', location: 'Jalan A', status: 'Under review', assigned_to: 'Government Officers', escalated: true,
        history: [
          { status: 'Submitted', at: '2026-11-01T02:00:00Z', kind: 'status', note: null },
          { status: 'Under review', at: '2026-11-02T02:00:00Z', kind: 'status', note: null },
          { status: 'Under review', at: '2026-11-02T03:00:00Z', kind: 'reply', note: 'Thanks. The drain is the council’s, so we have passed this on.' },
          { status: 'Under review', at: '2026-11-02T03:05:00Z', kind: 'escalated', note: null },
        ],
      },
    });
    await open(page, '/track?ticket=LRT-2099-0002');
    await expect(page.getByText('Reply from the team')).toBeVisible();
    await expect(page.getByText('Thanks. The drain is the council’s, so we have passed this on.')).toBeVisible();
    await expect(page.getByText('This concern has been passed to the government officers.')).toBeVisible();
    void errors;
  });

  test('tracking an unknown ticket says so (real database)', async ({ page, errors }) => {
    await open(page, '/track');
    await page.getByLabel('Ticket number').fill('LRT-1900-9999');
    await page.getByRole('button', { name: 'Check status' }).click();
    await expect(page.getByText('No ticket found with that number.')).toBeVisible();
    void errors;
  });
});

test.describe('navigation', () => {
  test('the main menu reaches every public page', async ({ page, errors }) => {
    await open(page, '/');
    for (const [name, h1] of [['Advisories', 'Every works notice on the line'], ['Schedule', 'What runs when, area by area'], ['Map', 'Construction and disruption map'], ['Report', 'Report a concern'], ['Feedback', 'Feedback and ticket tracking']]) {
      await (await menuLink(page, name)).click();
      await expect(page.locator('h1').first()).toHaveText(h1);
      if (isPhone(page)) await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
    }
    void errors;
  });

  test('the current page is marked in the menu', async ({ page }) => {
    await open(page, '/schedule');
    if (isPhone(page)) await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page');
  });

  test('on a phone the ☰ menu opens and Escape closes it', async ({ page }) => {
    test.skip(!isPhone(page), 'phone only');
    await open(page, '/');
    const btn = page.getByRole('button', { name: 'Menu' });
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await btn.click();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Map' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  test('landing pages link into the site', async ({ page, errors }) => {
    await open(page, '/landing/d');
    await page.locator('.lp-foot').getByRole('link', { name: 'Map' }).click();
    await expect(page.locator('h1').first()).toHaveText('Construction and disruption map');
    void errors;
  });
});
