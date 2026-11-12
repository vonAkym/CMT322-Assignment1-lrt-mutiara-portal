// Shared steps for the browser tests.
import { expect, test as base } from '@playwright/test';

// Every test fails if the page logs an error or throws, so a hidden crash cannot pass unnoticed.
// Each test gets `errors`, the list of problems seen so far.
export const test = base.extend({
  errors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await use(errors);
    expect(errors, 'errors in the browser console').toEqual([]);
  },
});
export { expect };

// Removes errors a test expects, e.g. allow(errors, /Invalid login credentials/) when a wrong password is the point.
export const allow = (errors, ...patterns) =>
  errors.splice(0, errors.length, ...errors.filter((e) => !patterns.some((p) => p.test(e))));

// Opens a page by its address after the # (e.g. '/advisories') and waits for its main heading.
export async function open(page, path) {
  await page.goto(`./#${path}`);
  await expect(page.locator('h1').first()).toBeVisible();
}

// True when the page is wider than the screen (sideways scrolling).
export const overflows = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

// Fake Supabase replies for anything that would save data. Unlisted requests still reach the real project.
export async function fakeWrites(page, { ticketNo = 'LRT-2099-0001', track = null } = {}) {
  await page.route('**/rest/v1/rpc/submit_ticket', (r) => r.fulfill({ json: ticketNo }));
  await page.route('**/storage/v1/object/ticket-photos/**', (r) => r.fulfill({ json: { Key: 'ticket-photos/x.jpg' } }));
  await page.route('**/rest/v1/subscriptions*', (r) => r.fulfill({ status: 201, body: '' }));
  if (track) await page.route('**/rest/v1/rpc/track_ticket', (r) => r.fulfill({ json: track }));
}

// A pretend Supabase sign-in for `role`. The real project is never asked to sign anyone in; every other request
// still goes to it as a visitor, so the pages show real advisories.
// name is the staff member's full name (used by the role rules: tickets can be given to a person by name).
export async function fakeSignIn(page, role = 'admin', name = 'Test Staff') {
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'staff@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, role: 'authenticated', exp, aud: 'authenticated' })}.sig`;
  await page.route('**/auth/v1/token?grant_type=password', async (r) => {
    const { password } = r.request().postDataJSON();
    if (password !== 'correct-password') return r.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' } });
    return r.fulfill({ json: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'fake-refresh', user } });
  });
  await page.route('**/auth/v1/user', (r) => r.fulfill({ json: user }));
  await page.route('**/auth/v1/logout*', (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('**/rest/v1/profiles*', (r) => r.fulfill({
    json: r.request().url().includes('role=in.') // listStaff() asks for every staff member
      ? [{ id: user.id, full_name: name, role }, { id: 'p2', full_name: 'Ravi', role: 'construction' }]
      : { full_name: name, role },
  }));
  // The fake token would be refused by the real project, so other requests go as a visitor instead.
  await page.route('**/rest/v1/**', (r) => {
    const headers = { ...r.request().headers() };
    if (headers.authorization?.includes(token)) delete headers.authorization;
    return r.fallback({ headers });
  });
}

// A pretend tickets table for the staff tests (the real one only answers signed-in staff). Call it after fakeSignIn.
// Returns the rows, so a test can check what was saved. A status change adds a history entry, like the real trigger.
export async function fakeTickets(page, tickets) {
  const rows = tickets.map((t) => ({ ...t }));
  const events = rows.map((t, i) => ({ id: i + 1, ticket_id: t.id, status: 'Submitted', note: null, created_at: t.created_at }));
  const wantsOne = (r) => (r.request().headers().accept || '').includes('vnd.pgrst.object');
  const param = (url, key) => new URL(url).searchParams.get(key)?.replace(/^eq\./, '');
  await page.route('**/rest/v1/tickets*', async (r) => {
    const req = r.request(), url = req.url();
    if (req.method() === 'PATCH') {
      const t = rows.find((x) => String(x.id) === param(url, 'id'));
      const changes = req.postDataJSON();
      if (changes.status && changes.status !== t.status) {
        events.push({ id: events.length + 1, ticket_id: t.id, status: changes.status, note: null, created_at: new Date().toISOString() });
      }
      Object.assign(t, changes);
      return r.fulfill({ json: wantsOne(r) ? t : [t] });
    }
    const no = param(url, 'ticket_no');
    if (no) {
      const t = rows.find((x) => x.ticket_no === no) || null;
      return r.fulfill({ json: wantsOne(r) ? t : (t ? [t] : []) });
    }
    return r.fulfill({ json: [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)) });
  });
  await page.route('**/rest/v1/ticket_events*', (r) => {
    const id = param(r.request().url(), 'ticket_id'); // none: every entry, for the response figures
    return r.fulfill({ json: id ? events.filter((e) => String(e.ticket_id) === id) : events });
  });
  // UC08 and UC09: the two database functions from migration 20261110000000_ticket_replies.sql.
  const addEvent = (t, kind, note) => {
    const e = { id: events.length + 1, ticket_id: t.id, status: t.status, kind, note, created_at: new Date().toISOString() };
    events.push(e);
    return e;
  };
  await page.route('**/rest/v1/rpc/reply_to_ticket', (r) => {
    const { p_ticket_id: id, p_message: note } = r.request().postDataJSON();
    return r.fulfill({ json: addEvent(rows.find((x) => x.id === id), 'reply', note) });
  });
  await page.route('**/rest/v1/rpc/escalate_ticket', (r) => {
    const { p_ticket_id: id, p_reason: reason } = r.request().postDataJSON();
    const t = rows.find((x) => x.id === id);
    Object.assign(t, { escalated_at: new Date().toISOString(), escalation_reason: reason, assigned_to: 'Government Officers' });
    addEvent(t, 'escalated', reason);
    return r.fulfill({ json: t });
  });
  rows.events = events;
  return rows;
}

// A pretend list of accounts for Manage staff roles (UC12). Returns the list, so a test can check what was saved.
export async function fakeAccounts(page, accounts) {
  const rows = accounts.map((a) => ({ ...a }));
  await page.route('**/rest/v1/rpc/list_accounts', (r) => r.fulfill({ json: rows }));
  await page.route('**/rest/v1/rpc/set_account', (r) => {
    const { p_user: id, p_role: role, p_full_name: name } = r.request().postDataJSON();
    const a = rows.find((x) => x.id === id);
    Object.assign(a, { role, full_name: name || a.full_name });
    return r.fulfill({ json: { id, role: a.role, full_name: a.full_name } });
  });
  return rows;
}
