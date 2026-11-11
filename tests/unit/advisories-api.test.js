// Module 1 database calls (src/modules/advisories/api.js), checked against a fake Supabase client:
// which rows each function asks for, and how it reads the answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fake } from './helpers/fakeSupabase.js';

vi.mock('../../src/shared/supabase.js', async (orig) =>
  ({ ...(await orig()), sb: (await import('./helpers/fakeSupabase.js')).fake.sb }));

const api = await import('../../src/modules/advisories/api.js');

beforeEach(() => { fake.reset(); vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-09T10:00:00') }); });
afterEach(() => { vi.useRealTimers(); });

const adv = (o) => ({ id: 1, state: 'Published', status: 'Ongoing', category: 'Road closure', severity: 'Low', starts_on: null, ends_on: null, ...o });

describe('isOverdue / isOver (advisory expiry)', () => {
  it('treats a published advisory past its end date as over', () => {
    expect(api.isOverdue(adv({ ends_on: '2026-11-08' }))).toBe(true);
    expect(api.isOver(adv({ ends_on: '2026-11-08' }))).toBe(true);
  });
  it('keeps it current on its last day and when there is no end date', () => {
    expect(api.isOver(adv({ ends_on: '2026-11-09' }))).toBe(false);
    expect(api.isOver(adv({ ends_on: null }))).toBe(false);
  });
  it('counts ended advisories as over, but never calls them overdue', () => {
    expect(api.isOver(adv({ state: 'Ended' }))).toBe(true);
    expect(api.isOverdue(adv({ state: 'Ended', ends_on: '2026-01-01' }))).toBe(false);
    expect(api.isOverdue(adv({ state: 'Draft', ends_on: '2026-01-01' }))).toBe(false);
  });
});

describe('isUrgent (UC05: High severity, under way or starting within 3 days)', () => {
  // Today is 2026-11-09 (see beforeEach), so works starting on 2026-11-12 or earlier are urgent.
  it('is urgent when the works are under way, have no start date, or start within 3 days', () => {
    expect(api.isUrgent(adv({ severity: 'High', starts_on: '2026-11-01' }))).toBe(true);
    expect(api.isUrgent(adv({ severity: 'High', starts_on: null }))).toBe(true);
    expect(api.isUrgent(adv({ severity: 'High', starts_on: '2026-11-12' }))).toBe(true);
  });
  it('is not urgent yet when the works start more than 3 days away, and says from when it will be', () => {
    const later = adv({ severity: 'High', starts_on: '2026-11-13' });
    expect(api.isUrgent(later)).toBe(false);
    expect(api.urgentFrom(later)).toBe('2026-11-10');
  });
  it('is never urgent when the severity is not High, or the advisory is over', () => {
    expect(api.isUrgent(adv({ severity: 'Medium', starts_on: '2026-11-01' }))).toBe(false);
    expect(api.isUrgent(adv({ severity: 'High', state: 'Ended' }))).toBe(false);
    expect(api.isUrgent(adv({ severity: 'High', ends_on: '2026-11-08' }))).toBe(false);
  });
  it('the banner asks the database for the same thing', async () => {
    await api.listUrgent();
    expect(fake.filters()).toContainEqual(['eq', 'severity', 'High']);
    expect(fake.filters()).toContainEqual(['or', 'starts_on.is.null,starts_on.lte.2026-11-12']);
  });
});

describe('listAdvisories (UC03 search and filters)', () => {
  it('asks only for current published advisories by default', async () => {
    await api.listAdvisories();
    expect(fake.calls[0]).toEqual(['from', 'updates']);
    expect(fake.filters()).toEqual([
      ['order', 'updated_at', { ascending: false }],
      ['eq', 'state', 'Published'],
      ['or', 'ends_on.is.null,ends_on.gte.2026-11-09'],
    ]);
  });
  it('the archive includes ended ones and published ones past their end date', async () => {
    await api.listAdvisories({ ended: true });
    expect(fake.filters()).toContainEqual(['or', 'state.eq.Ended,and(state.eq.Published,ends_on.lt.2026-11-09)']);
    expect(fake.filters()).not.toContainEqual(['eq', 'state', 'Published']);
  });
  it('adds each chosen filter', async () => {
    await api.listAdvisories({ zoneId: '3', category: 'Road closure', status: 'Ongoing', severity: 'High', onDate: '2026-11-20', limit: 5 });
    const f = fake.filters();
    expect(f).toContainEqual(['eq', 'zone_id', '3']);
    expect(f).toContainEqual(['eq', 'category', 'Road closure']);
    expect(f).toContainEqual(['eq', 'status', 'Ongoing']);
    expect(f).toContainEqual(['eq', 'severity', 'High']);
    expect(f).toContainEqual(['or', 'starts_on.is.null,starts_on.lte.2026-11-20']);
    expect(f).toContainEqual(['or', 'ends_on.is.null,ends_on.gte.2026-11-20']);
    expect(f).toContainEqual(['limit', 5]);
  });
  it('searches title, details and location, with unsafe characters removed', async () => {
    await api.listAdvisories({ q: 'Komtar (Jalan)' });
    expect(fake.filters()).toContainEqual(['or', 'title.ilike.%Komtar  Jalan%,body.ilike.%Komtar  Jalan%,location.ilike.%Komtar  Jalan%']);
  });
  it('ignores a badly formed date', async () => {
    await api.listAdvisories({ onDate: '20/11/2026' });
    expect(fake.filters().some(([, s]) => String(s).includes('starts_on.lte'))).toBe(false);
  });
  it('passes database errors on', async () => {
    fake.result = { data: null, error: new Error('offline') };
    await expect(api.listAdvisories()).rejects.toThrow('offline');
  });
});

describe('hubSummary (UC01 home page numbers)', () => {
  it('counts closures, ongoing works, urgent alerts and works this week', async () => {
    fake.result = { data: [
      adv({ id: 1, category: 'Road closure', status: 'Ongoing', severity: 'High' }),
      adv({ id: 2, category: 'Road closure', status: 'Planned', starts_on: '2026-12-01' }),
      adv({ id: 3, category: 'Progress', status: 'Ongoing', starts_on: '2026-11-01', ends_on: '2026-11-30' }),
      adv({ id: 4, category: 'Schedule', status: 'Planned', starts_on: '2026-11-14' }),
    ], error: null };
    const s = await api.hubSummary();
    expect(s).toMatchObject({ closures: 1, active: 2, urgent: 1, thisWeek: 3 });
    expect(s.latest.map((a) => a.id)).toEqual([1, 2, 3]);
  });
  it('does not count high-severity works that start more than 3 days away as urgent', async () => {
    fake.result = { data: [
      adv({ id: 1, severity: 'High', starts_on: '2026-11-10' }),
      adv({ id: 2, severity: 'High', status: 'Planned', starts_on: '2026-12-01' }),
    ], error: null };
    expect((await api.hubSummary()).urgent).toBe(1);
  });
});

describe('listSchedule (UC04)', () => {
  it('lists unfinished published works, soonest first, optionally for one area', async () => {
    await api.listSchedule({ zoneId: '2' });
    expect(fake.filters()).toEqual([
      ['eq', 'state', 'Published'],
      ['or', 'ends_on.is.null,ends_on.gte.2026-11-09'],
      ['order', 'starts_on', { ascending: true, nullsFirst: true }],
      ['eq', 'zone_id', '2'],
    ]);
  });
});

describe('zone alerts', () => {
  it('isEmail matches the database check', () => {
    expect(api.isEmail('name@example.com')).toBe(true);
    expect(api.isEmail('  name@example.com ')).toBe(true);
    expect(api.isEmail('name@example')).toBe(false);
    expect(api.isEmail('name example.com')).toBe(false);
    expect(api.isEmail('')).toBe(false);
  });
  it('saves the email trimmed and in lower case', async () => {
    expect(await api.subscribeToZone('4', '  Ali@Example.COM ')).toBe('added');
    expect(fake.calls).toContainEqual(['insert', { zone_id: 4, email: 'ali@example.com' }]);
  });
  it('reports an email that already follows the area', async () => {
    fake.result = { data: null, error: { code: '23505', message: 'duplicate key' } };
    expect(await api.subscribeToZone('4', 'ali@example.com')).toBe('already');
  });
  it('throws any other error', async () => {
    fake.result = { data: null, error: { code: '500', message: 'boom' } };
    await expect(api.subscribeToZone('4', 'ali@example.com')).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('photoUrl', () => {
  it('uses sample images and full links as they are, and storage links for uploads', () => {
    expect(api.photoUrl('assets/img/hero.jpg')).toBe('assets/img/hero.jpg');
    expect(api.photoUrl('https://x.test/a.jpg')).toBe('https://x.test/a.jpg');
    expect(api.photoUrl('abc.jpg')).toBe('https://storage.test/update-photos/abc.jpg');
  });
});

describe('staff saves (UC06 to UC08)', () => {
  it('creates when there is no id and updates when there is', async () => {
    fake.result = { data: { id: 9 }, error: null };
    await api.saveAdvisory(null, { title: 'New' });
    expect(fake.calls).toContainEqual(['insert', { title: 'New' }]);
    fake.reset(); fake.result = { data: { id: 9 }, error: null };
    await api.saveAdvisory(9, { title: 'Changed' });
    expect(fake.calls).toContainEqual(['update', { title: 'Changed' }]);
    expect(fake.calls).toContainEqual(['eq', 'id', 9]);
  });
  it('ending an advisory also marks the work completed', async () => {
    fake.result = { data: { id: 9 }, error: null };
    await api.endAdvisory(9);
    expect(fake.calls).toContainEqual(['update', { state: 'Ended', status: 'Completed' }]);
  });
  it('explains a refused save in plain words', async () => {
    fake.result = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
    await expect(api.publishAdvisory(9)).rejects.toThrow(/did not allow this change/);
  });
  it('signed-in staff only see their own advisories', async () => {
    fake.user = { id: 'u1' };
    await api.listMyAdvisories();
    expect(fake.calls).toContainEqual(['eq', 'created_by', 'u1']);
    fake.user = null;
  });
});
