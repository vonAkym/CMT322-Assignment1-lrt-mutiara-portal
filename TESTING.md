# Testing MutiaraInfo

Run the tests before every pull request. They check that what already works still works (regression testing).

| Command | What it runs | Time |
| --- | --- | --- |
| `npm test` | Unit and component tests (Vitest, in a fake browser, no database) | ~10 s |
| `npm run test:e2e` | Browser tests (Playwright in Microsoft Edge, desktop 1440 px and phone 390 px) | ~1 min |
| `npm run test:all` | Both | ~1 min |
| `npm run test:coverage` | Unit tests plus a coverage summary | ~10 s |
| `npm run test:watch` | Unit tests again on every save, while you work | – |

After `npm run test:e2e`, open `playwright-report/index.html` for the full results, with screenshots and a step-by-step trace for any failure.

## Two kinds of tests

**`tests/unit/`** (Vitest + React Testing Library) tests one function or one page at a time. Database calls are replaced with fakes, so these tests never need the internet.

| File | Covers |
| --- | --- |
| `util.test.js`, `supabase-helpers.test.js`, `links.test.js` | Shared helpers: dates, photo checks, search clean-up, page addresses |
| `advisories-api.test.js` | Module 1 queries: filters, archive and expiry, home numbers, schedule, zone alerts, staff saves |
| `advisories-pages.test.jsx` | Home, Advisories filters, advisory cards, zone alerts, urgent banner |
| `complaints.test.jsx` | Module 3: Report a concern and ticket tracking |
| `staff-pages.test.jsx` | My advisories form checks |
| `admin-api.test.js`, `tickets-logic.test.js` | Module 4 ticket queries, search and filters, counts, assignee choices |
| `admin-tickets.test.jsx` | Module 4 dashboard (list, filters, quick changes) and ticket page |
| `admin-complete-logic.test.js`, `admin-complete-pages.test.jsx` | Module 4 role rules, area, response time, report file, Manage staff roles |
| `app-staff-login.test.jsx` | The whole app: routes, staff-only pages, sign-in (UC01), header and phone menu |

**`tests/e2e/`** (Playwright) builds the real site and clicks through it in Edge, like a visitor.

| File | Covers |
| --- | --- |
| `smoke.spec.js` | Every page opens with its heading, no console errors and no sideways scrolling; logo, font, colours, dark mode |
| `public.spec.js` | Resident journeys: search, filters, advisory details, back button, schedule, map, report and track, zone alerts, menu |
| `staff.spec.js` | Sign-in, wrong password, staff-only pages, sign out, non-staff accounts |
| `admin-tickets.spec.js` | Ticket dashboard, filters, quick changes and the ticket page, with a pretend tickets table |
| `admin-complete.spec.js` | Staff roles in action, response figures, report download, Manage staff roles, area on the Report form |

Pages read the **real** Supabase project. Anything that would **save** (a report, a zone alert, a sign-in) gets a fake reply from `tests/e2e/helpers.js`, so the tests never change the database. One test does send a wrong password to the real project, which is harmless.

Every browser test also fails if the page logs an error to the console. If an error is expected (a refused sign-in, for example), the test lists it with `allow(errors, /pattern/)`.

## Adding a test for your module

- **A function or a page:** copy the pattern in a nearby `tests/unit/*.test.jsx` file. Mock your module's `api.js` with `vi.mock(...)` and use `renderPage()` from `tests/unit/helpers/render.jsx`.
- **A full journey:** add a `test(...)` to a `tests/e2e/*.spec.js` file. Use `open(page, '/your-page')`, and `fakeWrites` / `fakeSignIn` from `helpers.js` for anything that saves.
- Find elements the way a person would: `getByRole('button', { name: 'Save' })` and `getByLabel('Email')`, not CSS classes. Tests then keep working when the design changes.

## Requirements

Node 22 and Microsoft Edge (already on Windows). On a Mac or Linux without Edge, run `npx playwright install chromium` once and delete the `channel: 'msedge'` line in `playwright.config.js`.
