// Page addresses built in code. Other pages link with these, so a change here would break those links.
import { describe, expect, it } from 'vitest';
import { advisoriesUrl } from '../../src/modules/advisories/AdvisoriesPage.jsx';
import { trackUrl } from '../../src/modules/complaints/TrackPage.jsx';
import { reportUrl } from '../../src/modules/complaints/ReportPage.jsx';
import { where } from '../../src/modules/advisories/AdvisoryCard.jsx';

describe('advisoriesUrl', () => {
  it('builds the advisories address with only the filters that are set', () => {
    expect(advisoriesUrl()).toBe('/advisories');
    expect(advisoriesUrl({ q: '', zone: '' })).toBe('/advisories');
    expect(advisoriesUrl({ status: 'Ongoing', urgent: true })).toBe('/advisories?status=Ongoing&urgent=1');
    expect(advisoriesUrl({ q: 'Jalan Magazine', zone: '2' })).toBe('/advisories?q=Jalan+Magazine&zone=2');
  });
});

describe('trackUrl and reportUrl', () => {
  it('put the ticket number and location in the address safely', () => {
    expect(trackUrl('LRT-2026-0001')).toBe('/track?ticket=LRT-2026-0001');
    expect(reportUrl('Jalan A & B')).toBe('/report?location=Jalan%20A%20%26%20B');
    expect(reportUrl('')).toBe('/report');
  });
});

describe('where (advisory location text)', () => {
  it('uses the location, then the zone, then a fallback', () => {
    expect(where({ location: 'Komtar', zones: { name: 'George Town' } })).toBe('Komtar');
    expect(where({ location: '', zones: { name: 'George Town' } })).toBe('George Town');
    expect(where({})).toBe('Location to be confirmed');
  });
});
