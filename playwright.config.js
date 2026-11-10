// Browser tests (npm run test:e2e): builds the site, serves dist/ like GitHub Pages does, and clicks through it
// in Microsoft Edge, on a desktop screen and a phone screen. Pages read the real Supabase project, but every test
// that would save something (a report, a zone alert, a sign-in) answers with a fake reply, so the database is never changed.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    channel: 'msedge', // the Edge already installed on Windows; on other systems run `npx playwright install chromium` and remove this line
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Edge'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Desktop Edge'], viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
