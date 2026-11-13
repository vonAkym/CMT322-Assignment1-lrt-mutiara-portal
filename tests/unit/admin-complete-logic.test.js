// src/modules/admin/tickets.js, the parts added to finish Module 4: role rules (Figure 4), the area filter,
// response time (UC10) and the summary report file (UC11).
import { describe, expect, it } from 'vitest';
import { duration, filterTickets, firstResponse, responseStats, summaryReport, ticketRights, toCsv, visibleTickets } from '../../src/modules/admin/tickets.js';

const t = (o) => ({ id: 1, ticket_no: 'LRT-2026-0001', category: 'Noise', description: 'x', status: 'Submitted', priority: 'Medium', assigned_to: null, escalated_at: null, zone_id: null, created_at: '2026-11-01T00:00:00Z', ...o });
const none = { q: '', category: '', zone: '', status: '', priority: '', assigned: '', escalated: '' };
const ADMIN = { role: 'admin', full_name: 'Aisyah' };
const BUILDER = { role: 'construction', full_name: 'Ravi' };
const OFFICER = { role: 'government', full_name: 'Siti' };

describe('ticketRights (who may do what, same rule as the database)', () => {
  it('admins manage and handle every ticket', () => {
    expect(ticketRights(ADMIN, t())).toEqual({ manage: true, handle: true });
  });
  it('the Construction Team handles tickets given to the team or to them by name, and never manages', () => {
    expect(ticketRights(BUILDER, t({ assigned_to: 'Construction Team' }))).toEqual({ manage: false, handle: true });
    expect(ticketRights(BUILDER, t({ assigned_to: 'Ravi' }))).toEqual({ manage: false, handle: true });
    expect(ticketRights(BUILDER, t({ assigned_to: null })).handle).toBe(false);
    expect(ticketRights(BUILDER, t({ assigned_to: 'Government Officers' })).handle).toBe(false);
    expect(ticketRights(BUILDER, t({ escalated_at: '2026-11-02T00:00:00Z' })).handle).toBe(false);
  });
  it('Government Officers handle escalated tickets, tickets for the officers, or for them by name', () => {
    expect(ticketRights(OFFICER, t({ escalated_at: '2026-11-02T00:00:00Z' })).handle).toBe(true);
    expect(ticketRights(OFFICER, t({ assigned_to: 'Government Officers' })).handle).toBe(true);
    expect(ticketRights(OFFICER, t({ assigned_to: 'Siti' })).handle).toBe(true);
    expect(ticketRights(OFFICER, t({ assigned_to: 'Construction Team' })).handle).toBe(false);
    expect(ticketRights(OFFICER, t()).manage).toBe(false);
  });
  it('a staff member without a name only gets team tickets, and anyone else gets nothing', () => {
    expect(ticketRights({ role: 'construction', full_name: null }, t({ assigned_to: null })).handle).toBe(false);
    expect(ticketRights({ role: 'resident' }, t({ assigned_to: 'Construction Team' }))).toEqual({ manage: false, handle: false });
    expect(ticketRights(null, t())).toEqual({ manage: false, handle: false });
  });
});

describe('filterTickets: area and "tickets I can work on"', () => {
  const list = [t({ id: 1, zone_id: 1, assigned_to: 'Construction Team' }), t({ id: 2, zone_id: 2 }), t({ id: 3, zone_id: null, assigned_to: 'Ravi' })];
  const ids = (l) => l.map((x) => x.id);
  it('filters by area, or tickets without one', () => {
    expect(ids(filterTickets(list, { ...none, zone: '2' }))).toEqual([2]);
    expect(ids(filterTickets(list, { ...none, zone: 'none' }))).toEqual([3]);
  });
  it('"mine" keeps the tickets the signed-in person may handle', () => {
    expect(ids(filterTickets(list, { ...none, assigned: 'mine' }, BUILDER))).toEqual([1, 3]);
    expect(ids(filterTickets(list, { ...none, assigned: 'mine' }, OFFICER))).toEqual([]);
  });
});

describe('visibleTickets: Construction Team and Government Officers see only the tickets given to them', () => {
  const list = [
    t({ id: 1 }),                                                   // unassigned
    t({ id: 2, assigned_to: 'Construction Team' }),
    t({ id: 3, assigned_to: 'Ravi' }),                              // given to Ravi by name
    t({ id: 4, assigned_to: 'Government Officers' }),
    t({ id: 5, escalated_at: '2026-11-03T00:00:00Z', assigned_to: 'Government Officers' }),
    t({ id: 6, assigned_to: 'Siti' }),                              // given to Siti by name
  ];
  const ids = (l) => l.map((x) => x.id);
  it('admins see every ticket', () => expect(ids(visibleTickets(list, ADMIN))).toEqual([1, 2, 3, 4, 5, 6]));
  it('the Construction Team sees its team’s tickets and its own', () => expect(ids(visibleTickets(list, BUILDER))).toEqual([2, 3]));
  it('Government Officers see escalated, their team’s and their own', () => expect(ids(visibleTickets(list, OFFICER))).toEqual([4, 5, 6]));
  it('nobody else sees any', () => expect(visibleTickets(list, { role: 'resident' })).toEqual([]));
});

describe('response time (UC10)', () => {
  const ev = (o) => ({ ticket_id: 1, kind: 'status', status: 'Submitted', created_at: '2026-11-01T00:00:00Z', ...o });
  it('the first response is the first status change, reply or escalation after the ticket was sent', () => {
    expect(firstResponse(t(), [ev()])).toBeNull(); // only the automatic "Submitted" entry
    expect(firstResponse(t(), [ev(), ev({ status: 'Under review', created_at: '2026-11-01T05:00:00Z' }), ev({ kind: 'reply', created_at: '2026-11-01T02:00:00Z' })])).toBe(2 * 3600e3);
    expect(firstResponse(t(), [ev({ kind: 'escalated', created_at: '2026-11-01T01:00:00Z' })])).toBe(3600e3);
    expect(firstResponse(t(), [ev({ ticket_id: 2, status: 'Resolved', created_at: '2026-11-01T01:00:00Z' })])).toBeNull(); // another ticket
  });
  it('averages the answered tickets and counts the waiting ones', () => {
    const tickets = [t({ id: 1 }), t({ id: 2 }), t({ id: 3 })];
    const events = [ev({ ticket_id: 1, status: 'Under review', created_at: '2026-11-01T02:00:00Z' }), ev({ ticket_id: 2, kind: 'reply', created_at: '2026-11-01T04:00:00Z' })];
    expect(responseStats(tickets, events)).toEqual({ average: 3 * 3600e3, answered: 2, waiting: 1 });
    expect(responseStats([], [])).toEqual({ average: null, answered: 0, waiting: 0 });
  });
  it('writes durations in plain words', () => {
    expect(duration(null)).toBe('–');
    expect(duration(20 * 1000)).toBe('1 min');
    expect(duration(45 * 60e3)).toBe('45 min');
    expect(duration(5.5 * 3600e3)).toBe('5.5 h');
    expect(duration(3 * 86400e3)).toBe('3 days');
  });
});

describe('summary report file (UC11)', () => {
  it('quotes cells that need it, so commas and quotes survive in Excel', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', null, 3], ['line\nbreak']])).toBe('a,"b,c","say ""hi""",,3\r\n"line\nbreak"');
  });
  it('holds the filters, the figures and one row per ticket', () => {
    const csv = summaryReport({
      tickets: [t({ zone_id: 1, assigned_to: 'Ravi', description: 'Loud, at night' }), t({ id: 2, ticket_no: 'LRT-2026-0002', category: 'Dust', escalated_at: '2026-11-02T00:00:00Z' })],
      events: [{ ticket_id: 1, kind: 'reply', status: 'Submitted', created_at: '2026-11-01T03:00:00Z' }],
      zoneName: (id) => (id === 1 ? 'George Town' : 'No area given'),
      filters: { status: 'Submitted', q: '' },
      now: new Date('2026-11-13T10:00:00Z'),
    });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('MutiaraInfo ticket summary report');
    expect(csv).toContain('Filters,status=Submitted');
    expect(csv).toContain('Tickets,2');
    expect(csv).toContain('Average first response,3 h');
    expect(csv).toContain('Waiting for a first response,1');
    expect(csv).toContain('Escalated to the government,1');
    expect(csv).toContain('George Town,1');
    expect(lines).toContain('Ticket,Submitted,Category,Area,Location,Priority,Status,Assigned to,Escalated,First response,Description');
    expect(lines.find((l) => l.startsWith('LRT-2026-0001'))).toMatch(/,Noise,George Town,,Medium,Submitted,Ravi,No,3 h,"Loud, at night"$/);
    expect(lines.find((l) => l.startsWith('LRT-2026-0002'))).toMatch(/,Dust,No area given,.*,Unassigned,Yes,–,/);
  });
});
