// The one Supabase connection, plus small helpers that every module's api.js uses.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Supabase answers { data, error }. ok() returns the data or throws the error.
export const ok = ({ data, error }) => { if (error) throw error; return data; };

// Removes characters that would break a PostgREST filter string.
export const clean = (s) => String(s).replace(/[,()%*]/g, ' ').trim();

export const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// Both photo uploads (complaints and advisories) accept the same files.
export const isPhotoOk = (file) => ['image/jpeg', 'image/png'].includes(file.type) && file.size <= 5 * 1024 * 1024;
export function checkPhoto(file) {
  if (!isPhotoOk(file)) throw new Error('Photo must be a JPG or PNG up to 5 MB.');
}
export const photoName = (file) => `${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;

// Zones are used by several modules (area dropdowns).
export const listZones = async () => ok(await sb.from('zones').select('id, name').order('name'));
