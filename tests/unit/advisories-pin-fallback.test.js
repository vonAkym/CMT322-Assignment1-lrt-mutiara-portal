// Module 1: advisories keep working before the map pin columns exist in the database
// (supabase/migrations/20261113010000_advisory_location.sql not run yet). Its own file, because once the site
// has found the columns missing it stops asking for them, and that would change the other API tests.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake } from './helpers/fakeSupabase.js';

vi.mock('../../src/shared/supabase.js', async (orig) =>
  ({ ...(await orig()), sb: (await import('./helpers/fakeSupabase.js')).fake.sb }));

const api = await import('../../src/modules/advisories/api.js');

// The database's answers, one per query, in order.
function answers(...list) {
  Object.defineProperty(fake, 'result', { configurable: true, get: () => list.shift() || { data: [], error: null } });
}
const MISSING = { data: null, error: { code: '42703', message: 'column updates.lat does not exist' } };
const selects = () => fake.calls.filter(([n]) => n === 'select').map(([, cols]) => cols);

beforeEach(() => { fake.calls.length = 0; });

describe('advisories without the pin columns', () => {
  it('asks for the pin first, and asks again without it when the database has no such columns', async () => {
    answers(MISSING, { data: [{ id: 1, title: 'Works' }], error: null });
    expect(await api.listAdvisories()).toEqual([{ id: 1, title: 'Works' }]);
    const [first, second] = selects();
    expect(first).toContain('lat, lng');
    expect(second).not.toContain('lat');
    expect(second).toContain('location, starts_on');
  });

  it('then stops asking for the pin, so each page needs only one query', async () => {
    answers({ data: { id: 2 }, error: null });
    expect(await api.getAdvisory(2)).toEqual({ id: 2 });
    expect(selects()).toHaveLength(1);
    expect(selects()[0]).not.toContain('lat');
  });

  it('explains a pin that cannot be saved yet', async () => {
    answers({ data: null, error: { code: 'PGRST204', message: "Could not find the 'lat' column of 'updates' in the schema cache" } });
    await expect(api.saveAdvisory(9, { lat: 5.41, lng: 100.33 })).rejects.toThrow(/database has not been updated for pins yet/);
  });

  it('passes other errors on as before', async () => {
    answers({ data: null, error: new Error('offline') });
    await expect(api.listSchedule()).rejects.toThrow('offline');
  });
});

describe('queries under way at the same time', () => {
  it('each asks again without the pin, even after another one already found the columns missing', async () => {
    vi.resetModules();
    const fresh = await import('../../src/modules/advisories/api.js');
    answers(MISSING, MISSING, { data: [{ id: 1 }], error: null }, { data: [{ id: 2 }], error: null });
    const [a, b] = await Promise.all([fresh.listAdvisories(), fresh.listSchedule()]);
    expect([a, b]).toEqual([[{ id: 1 }], [{ id: 2 }]]);
  });
});
