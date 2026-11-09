// src/modules/admin/tickets.js: ticket search and filters (UC03), counts (UC10), assignee choices (UC06).
import { describe, expect, it } from 'vitest';
import { actionError, assigneeOptions, checkNote, countBy, filterTickets, historyItem, readFilters, reporter, TEAMS } from '../../src/modules/admin/tickets.js';

const T = [
  { id: 1, ticket_no: 'LRT-2026-0001', category: 'Noise', description: 'Piling after 10 pm', location: 'Komtar', reporter_name: 'Ali', status: 'Submitted', priority: 'High', assigned_to: null },
  { id: 2, ticket_no: 'LRT-2026-0002', category: 'Dust', description: 'Dust on the shop front', location: 'Jalan Sample', reporter_name: null, status: 'In progress', priority: 'Medium', assigned_to: 'Construction Team', escalated_at: '2026-11-04T02:00:00Z' },
  { id: 3, ticket_no: 'LRT-2026-0003', category: 'Noise', description: 'Generator noise', location: null, reporter_name: 'Mei Ling', status: 'Resolved', priority: 'Low', assigned_to: 'Aisyah' },
];
const ids = (list) => list.map((t) => t.id);
const none = { q: '', category: '', status: '', priority: '', assigned: '', escalated: '' };

describe('filterTickets', () => {
  it('returns every ticket with no filters', () => { expect(ids(filterTickets(T, none))).toEqual([1, 2, 3]); });
  it('filters by category, status and priority, together', () => {
    expect(ids(filterTickets(T, { ...none, category: 'Noise' }))).toEqual([1, 3]);
    expect(ids(filterTickets(T, { ...none, status: 'In progress' }))).toEqual([2]);
    expect(ids(filterTickets(T, { ...none, category: 'Noise', priority: 'Low' }))).toEqual([3]);
    expect(ids(filterTickets(T, { ...none, category: 'Dust', status: 'Resolved' }))).toEqual([]);
  });
  it('filters by assignee, or unassigned only', () => {
    expect(ids(filterTickets(T, { ...none, assigned: 'Aisyah' }))).toEqual([3]);
    expect(ids(filterTickets(T, { ...none, assigned: 'none' }))).toEqual([1]);
  });
  it('searches ticket number, description, location and reporter, ignoring case and word order', () => {
    expect(ids(filterTickets(T, { ...none, q: '0002' }))).toEqual([2]);
    expect(ids(filterTickets(T, { ...none, q: 'komtar' }))).toEqual([1]);
    expect(ids(filterTickets(T, { ...none, q: 'mei' }))).toEqual([3]);
    expect(ids(filterTickets(T, { ...none, q: 'front shop' }))).toEqual([2]);
    expect(ids(filterTickets(T, { ...none, q: 'noise komtar' }))).toEqual([]); // "noise" is the category, not in the text
    expect(ids(filterTickets(T, { ...none, q: '   ' }))).toEqual([1, 2, 3]);
  });
});

describe('readFilters', () => {
  it('reads the filters from the address, empty when missing', () => {
    expect(readFilters(new URLSearchParams('status=Submitted&q=dust&x=1'))).toEqual({ ...none, status: 'Submitted', q: 'dust' });
  });
});

describe('countBy', () => {
  it('counts per value, listing the given keys even when zero', () => {
    expect(countBy(T, 'status', ['Submitted', 'Under review', 'In progress', 'Resolved'])).toEqual({ Submitted: 1, 'Under review': 0, 'In progress': 1, Resolved: 1 });
    expect(countBy(T, 'category')).toEqual({ Noise: 2, Dust: 1 });
    expect(countBy([], 'priority', ['High'])).toEqual({ High: 0 });
  });
});

describe('assigneeOptions (UC06)', () => {
  const staff = [
    { id: 'a', full_name: 'Aisyah', role: 'admin' },
    { id: 'b', full_name: 'Ravi', role: 'construction' },
    { id: 'c', full_name: null, role: 'government' }, // no name yet: left out
  ];
  it('offers the teams first, then each named staff member with their role', () => {
    expect(assigneeOptions(staff)).toEqual([
      ...TEAMS.map((t) => ({ value: t, label: t })),
      { value: 'Aisyah', label: 'Aisyah (Admin)' },
      { value: 'Ravi', label: 'Ravi (Construction Team)' },
    ]);
  });
  it('keeps an assignee saved earlier who is no longer on the staff list', () => {
    expect(assigneeOptions(staff, 'Officer A').at(-1)).toEqual({ value: 'Officer A', label: 'Officer A' });
    expect(assigneeOptions(staff, 'Aisyah')).toHaveLength(4);
  });
});

describe('reporter', () => {
  it('shows the name, Anonymous, or Not given', () => {
    expect(reporter({ reporter_name: 'Ali', is_anonymous: false })).toBe('Ali');
    expect(reporter({ reporter_name: null, is_anonymous: true })).toBe('Anonymous');
    expect(reporter({ reporter_name: null, is_anonymous: false })).toBe('Not given');
  });
});

describe('UC08 and UC09 helpers', () => {
  it('filters escalated tickets only', () => {
    expect(ids(filterTickets(T, { ...none, escalated: '1' }))).toEqual([2]);
  });
  it('checkNote wants 5 to 1000 characters, not counting spaces at the ends', () => {
    expect(checkNote('   hi   ', 'reply')).toBe('Write the reply (at least 5 characters).');
    expect(checkNote('We are on it.', 'reply')).toBe('');
    expect(checkNote('x'.repeat(1001), 'reason')).toBe('Keep the reason under 1000 characters.');
  });
  it('historyItem names each kind of entry', () => {
    expect(historyItem({ kind: 'status', status: 'Resolved', note: null })).toEqual({ title: 'Resolved', note: null });
    expect(historyItem({ status: 'Submitted' })).toEqual({ title: 'Submitted', note: undefined }); // before the migration
    expect(historyItem({ kind: 'reply', status: 'Submitted', note: 'Thanks' })).toEqual({ title: 'Reply to resident', note: 'Thanks' });
    expect(historyItem({ kind: 'escalated', status: 'Submitted', note: 'Public road' })).toEqual({ title: 'Escalated to the government', note: 'Reason: Public road' });
  });
  it('actionError explains a missing database update, a refused action, and anything else', () => {
    expect(actionError({ code: 'PGRST202', message: 'Could not find the function' }, 'send the reply')).toMatch(/needs the latest update/);
    expect(actionError({ code: 'P0002', message: 'No such ticket, or it is already escalated' }, 'escalate the ticket'))
      .toBe('Could not escalate the ticket: No such ticket, or it is already escalated.');
    expect(actionError(new Error('offline'), 'send the reply')).toBe('Could not send the reply. Please try again.');
  });
});
