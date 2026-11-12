// src/shared/supabase.js: the small helpers every module's api.js uses.
import { describe, expect, it } from 'vitest';
import { checkPhoto, clean, isDay, isPhotoOk, ok, photoName } from '../../src/shared/supabase.js';

const file = (type, size = 1000) => ({ type, size });

describe('ok()', () => {
  it('returns the data, or throws the database error', () => {
    expect(ok({ data: [1, 2], error: null })).toEqual([1, 2]);
    const error = new Error('denied');
    expect(() => ok({ data: null, error })).toThrow('denied');
  });
});

describe('clean()', () => {
  it('removes characters that would break a search filter', () => {
    expect(clean('Jalan (Magazine), 50%*')).not.toMatch(/[,()%*]/);
    expect(clean('Jalan (Magazine), 50%*')).toMatch(/^Jalan\s+Magazine\s+50$/);
    expect(clean('  Komtar  ')).toBe('Komtar');
  });
});

describe('isDay()', () => {
  it('accepts only YYYY-MM-DD', () => {
    expect(isDay('2026-11-09')).toBe(true);
    expect(isDay('9/11/2026')).toBe(false);
    expect(isDay('')).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });
});

describe('photo checks (shared by Report and the advisory form)', () => {
  it('allows JPG and PNG up to 5 MB', () => {
    expect(isPhotoOk(file('image/jpeg'))).toBe(true);
    expect(isPhotoOk(file('image/png', 5 * 1024 * 1024))).toBe(true);
  });
  it('refuses other types and files over 5 MB', () => {
    expect(isPhotoOk(file('image/gif'))).toBe(false);
    expect(isPhotoOk(file('application/pdf'))).toBe(false);
    expect(isPhotoOk(file('image/jpeg', 5 * 1024 * 1024 + 1))).toBe(false);
    expect(() => checkPhoto(file('image/gif'))).toThrow('Photo must be a JPG or PNG up to 5 MB.');
  });
  it('gives each upload a random name with the right extension', () => {
    expect(photoName(file('image/png'))).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(photoName(file('image/jpeg'))).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(photoName(file('image/jpeg'))).not.toBe(photoName(file('image/jpeg')));
  });
});
