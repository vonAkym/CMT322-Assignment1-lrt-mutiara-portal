// Module 4 database calls (src/modules/admin/api.js), checked against a fake Supabase client.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake } from './helpers/fakeSupabase.js';

vi.mock('../../src/shared/supabase.js', async (orig) =>
  ({ ...(await orig()), sb: (await import('./helpers/fakeSupabase.js')).fake.sb }));
const api = await import('../../src/modules/admin/api.js');

beforeEach(() => { fake.reset(); });

describe('tickets', () => {
  it('listTickets reads every ticket, newest first', async () => {
    await api.listTickets();
    expect(fake.calls[0]).toEqual(['from', 'tickets']);
    expect(fake.filters()).toEqual([['order', 'created_at', { ascending: false }]]);
  });
  it('getTicket finds the ticket by number, then its history oldest first', async () => {
    fake.result = { data: { id: 7, ticket_no: 'LRT-2026-0007' }, error: null };
    const t = await api.getTicket('LRT-2026-0007');
    expect(fake.calls).toContainEqual(['eq', 'ticket_no', 'LRT-2026-0007']);
    expect(fake.calls).toContainEqual(['from', 'ticket_events']);
    expect(fake.calls).toContainEqual(['eq', 'ticket_id', 7]);
    expect(fake.calls).toContainEqual(['order', 'created_at', { ascending: true }]);
    expect(t).toHaveProperty('history');
  });
  it('getTicket returns null without asking for history when there is no such ticket', async () => {
    fake.result = { data: null, error: null };
    expect(await api.getTicket('LRT-0000')).toBeNull();
    expect(fake.calls).not.toContainEqual(['from', 'ticket_events']);
  });
  it('updateTicket saves only the given fields of that ticket', async () => {
    fake.result = { data: { id: 7 }, error: null };
    await api.updateTicket(7, { status: 'Resolved' });
    expect(fake.calls).toContainEqual(['update', { status: 'Resolved' }]);
    expect(fake.calls).toContainEqual(['eq', 'id', 7]);
  });
  it('passes a refused change on as an error', async () => {
    fake.result = { data: null, error: new Error('row-level security') };
    await expect(api.updateTicket(7, { status: 'Resolved' })).rejects.toThrow('row-level security');
  });
});

describe('staff list (UC06)', () => {
  it('asks only for staff roles, by name', async () => {
    await api.listStaff();
    expect(fake.calls[0]).toEqual(['from', 'profiles']);
    expect(fake.filters()).toEqual([['in', 'role', ['admin', 'construction', 'government']], ['order', 'full_name']]);
  });
});

describe('reply and escalate (UC08, UC09)', () => {
  it('replyToTicket calls the database function with the trimmed message', async () => {
    await api.replyToTicket(7, '  We will check tonight.  ');
    expect(fake.calls[0]).toEqual(['rpc', 'reply_to_ticket', { p_ticket_id: 7, p_message: 'We will check tonight.' }]);
  });
  it('escalateTicket calls the database function with the trimmed reason', async () => {
    await api.escalateTicket(7, ' Public road ');
    expect(fake.calls[0]).toEqual(['rpc', 'escalate_ticket', { p_ticket_id: 7, p_reason: 'Public road' }]);
  });
  it('passes a refusal on', async () => {
    fake.result = { data: null, error: { code: '42501', message: 'Only staff can reply to tickets' } };
    await expect(api.replyToTicket(7, 'Hello there')).rejects.toMatchObject({ code: '42501' });
  });
});
