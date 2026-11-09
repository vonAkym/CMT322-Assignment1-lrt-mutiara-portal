// src/shared/util.js: dates, date ranges and "time ago" text used on every advisory.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, ago, dateRange, day, daysBetween, todayISO, CATS, STAT, SEVERITY } from '../../src/shared/util.js';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-09T10:00:00') }); });
afterEach(() => { vi.useRealTimers(); });

describe('lists', () => {
  it('keeps the categories, ticket statuses and severities the database accepts', () => {
    expect(CATS).toEqual(['Road closure', 'Schedule', 'Business access', 'Progress']);
    expect(STAT).toEqual(['Submitted', 'Under review', 'In progress', 'Resolved']);
    expect(SEVERITY).toEqual(['Low', 'Medium', 'High']);
  });
});

describe('todayISO / addDays / daysBetween', () => {
  it('gives today as YYYY-MM-DD in local time', () => { expect(todayISO()).toBe('2026-11-09'); });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-09', 7)).toBe('2026-11-16');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // leap year
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-09')).toBe(8);
    expect(daysBetween('2026-11-09', '2026-11-01')).toBe(-8);
    expect(daysBetween('2026-11-09', '2026-11-09')).toBe(0);
  });
});

describe('day and dateRange', () => {
  it('writes a day as "9 Nov 2026", or "9 Nov" without the year', () => {
    expect(day('2026-11-09')).toBe('9 Nov 2026');
    expect(day('2026-11-09', false)).toBe('9 Nov');
  });
  it('covers every combination of start and end dates', () => {
    expect(dateRange(null, null)).toBe('Dates to be confirmed');
    expect(dateRange('2026-11-05', null)).toBe('From 5 Nov 2026');
    expect(dateRange(null, '2026-11-15')).toBe('Until 15 Nov 2026');
    expect(dateRange('2026-11-05', '2026-11-15')).toBe('5 Nov – 15 Nov 2026');
    expect(dateRange('2026-12-20', '2027-01-10')).toBe('20 Dec 2026 – 10 Jan 2027'); // year shown on both ends
  });
});

describe('ago', () => {
  const minus = (ms) => new Date(Date.now() - ms).toISOString();
  it('says how long ago something changed', () => {
    expect(ago(minus(10 * 1000))).toBe('just now');
    expect(ago(minus(5 * 60e3))).toBe('5 min ago');
    expect(ago(minus(60 * 60e3))).toBe('1 hour ago');
    expect(ago(minus(3 * 3600e3))).toBe('3 hours ago');
    expect(ago(minus(24 * 3600e3))).toBe('1 day ago');
    expect(ago(minus(2 * 86400e3))).toBe('2 days ago');
  });
  it('falls back to the date after a month', () => {
    expect(ago(minus(40 * 86400e3))).toBe('30 Sept 2026'.replace('Sept', new Date(2026, 8, 30).toLocaleDateString('en-GB', { month: 'short' })));
  });
});
