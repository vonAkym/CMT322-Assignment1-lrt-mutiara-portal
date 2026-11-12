// Module 1: work hours chosen with time pickers and day boxes (feat/work-hours).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { advisory, renderPage } from './helpers/render.jsx';
import { dayText, formatHours, hoursNow, overnight, parseHours, to12h } from '../../src/modules/advisories/workHours.js';

vi.mock('../../src/shared/supabase.js', async (orig) => {
  const { SAMPLE_ZONES } = await import('./helpers/render.jsx');
  return { ...(await orig()), listZones: async () => SAMPLE_ZONES };
});
vi.mock('../../src/shared/staff.jsx', () => ({ useStaff: () => ({ user: { id: 'u1' }, profile: { role: 'construction' } }) }));
vi.mock('../../src/modules/advisories/api.js', async (orig) => ({
  ...(await orig()),
  getAdvisory: vi.fn(), listMyAdvisories: vi.fn(async () => []), saveAdvisory: vi.fn(),
}));
vi.mock('../../src/modules/advisories/AdvisoryMap.jsx', async (orig) => ({
  ...(await orig()), LocationPicker: () => null, PlaceMap: () => null,
}));
const api = await import('../../src/modules/advisories/api.js');
const { default: AdvisoryFormPage } = await import('../../src/modules/advisories/AdvisoryFormPage.jsx');
const { default: AdvisoryPage } = await import('../../src/modules/advisories/AdvisoryPage.jsx');

const MON_SAT = [0, 1, 2, 3, 4, 5];
// A local date and time; 2026-11-13 is a Friday.
const at = (iso, hhmm) => new Date(`${iso}T${hhmm}:00`);

describe('how work hours are written', () => {
  it('writes times in 12-hour form', () => {
    expect(['00:00', '06:05', '12:00', '22:30'].map(to12h)).toEqual(['12:00 am', '6:05 am', '12:00 pm', '10:30 pm']);
  });
  it('joins days that follow each other, and lists the others', () => {
    expect(dayText([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(dayText([5, 0, 1, 2, 3, 4])).toBe('Mon–Sat');
    expect(dayText([5, 6])).toBe('Sat, Sun');
    expect(dayText([0, 2, 4])).toBe('Mon, Wed, Fri');
  });
  it('writes and reads back the same hours', () => {
    const cases = [
      { from: '22:00', to: '06:00', days: MON_SAT, allDay: false },
      { from: '09:00', to: '17:30', days: [0, 2, 4], allDay: false },
      { from: '', to: '', days: [0, 1, 2, 3, 4, 5, 6], allDay: true },
    ];
    expect(cases.map(formatHours)).toEqual(['10:00 pm – 6:00 am, Mon–Sat', '9:00 am – 5:30 pm, Mon, Wed, Fri', '24 hours, Every day']);
    cases.forEach((h) => expect(parseHours(formatHours(h))).toEqual(h));
  });
  it('cannot read text written another way, so it is kept as it is', () => {
    expect(parseHours('9 am to 5 pm, Monday to Saturday')).toBeNull();
    expect(parseHours('3 hours')).toBeNull();
    expect(parseHours('')).toBeNull();
    expect(parseHours(null)).toBeNull();
  });
  it('knows works that end before they start run overnight', () => {
    expect(overnight({ from: '22:00', to: '06:00' })).toBe(true);
    expect(overnight({ from: '09:00', to: '17:00' })).toBe(false);
  });
});

describe('hoursNow: are the works going on at this moment?', () => {
  it('daytime works: only inside the hours, on the chosen days', () => {
    const h = '9:00 am – 5:00 pm, Mon–Fri';
    expect(hoursNow(h, at('2026-11-13', '10:00'))).toBe(true);  // Friday
    expect(hoursNow(h, at('2026-11-13', '17:00'))).toBe(false); // ends at 5 pm
    expect(hoursNow(h, at('2026-11-13', '08:59'))).toBe(false);
    expect(hoursNow(h, at('2026-11-14', '10:00'))).toBe(false); // Saturday
  });
  it('overnight works: from the evening of a chosen day into the next morning', () => {
    const h = '10:00 pm – 6:00 am, Mon–Fri';
    expect(hoursNow(h, at('2026-11-13', '23:00'))).toBe(true);  // Friday night
    expect(hoursNow(h, at('2026-11-14', '05:00'))).toBe(true);  // Saturday morning, after Friday night
    expect(hoursNow(h, at('2026-11-16', '05:00'))).toBe(false); // Monday morning: Sunday night has no works
    expect(hoursNow(h, at('2026-11-13', '12:00'))).toBe(false);
  });
  it('24 hours: all day on the chosen days', () => {
    expect(hoursNow('24 hours, Sat, Sun', at('2026-11-14', '03:00'))).toBe(true);
    expect(hoursNow('24 hours, Sat, Sun', at('2026-11-13', '03:00'))).toBe(false);
  });
  it('cannot tell for text written another way', () => {
    expect(hoursNow('Deliveries 7 am to 10 am')).toBeNull();
  });
});

describe('Advisory form: the work hours pickers', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  const newForm = () => renderPage(<AdvisoryFormPage />, { path: '/manage/new', others: ['/manage'] });
  const editForm = async (a) => {
    api.getAdvisory.mockResolvedValue({ created_by: 'u1', ...a });
    const r = renderPage(<AdvisoryFormPage />, { path: '/manage/:id/edit', at: `/manage/${a.id}/edit`, others: ['/manage'] });
    await screen.findByLabelText(/^Title/);
    return r;
  };
  const start = async (user) => { await user.type(screen.getByLabelText(/^Title/), 'Night lane closure'); };
  const saved = async () => { await waitFor(() => expect(api.saveAdvisory).toHaveBeenCalled()); return api.saveAdvisory.mock.calls[0][1]; };

  it('saves the chosen times and days in the site’s format, and shows how the public will see them', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 50, state: 'Draft' }));
    const { user } = newForm();
    await start(user);
    await user.type(screen.getByLabelText('Start time'), '22:00');
    await user.type(screen.getByLabelText('End time'), '06:00');
    await user.click(screen.getByRole('button', { name: 'Mon–Sat' }));
    expect(screen.getByText(/Shown to the public as/)).toHaveTextContent('10:00 pm – 6:00 am, Mon–Sat (overnight, ending the next morning)');
    await user.click(screen.getByRole('button', { name: /Save as draft/ }));
    expect((await saved()).work_hours).toBe('10:00 pm – 6:00 am, Mon–Sat');
  });

  it('24 hours needs no times', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 50, state: 'Draft' }));
    const { user } = newForm();
    await start(user);
    await user.click(screen.getByLabelText(/24 hours/));
    expect(screen.getByLabelText('Start time')).toBeDisabled();
    await user.click(screen.getByLabelText('Sat'));
    await user.click(screen.getByLabelText('Sun'));
    await user.click(screen.getByRole('button', { name: /Save as draft/ }));
    expect((await saved()).work_hours).toBe('24 hours, Sat, Sun');
  });

  it('work hours stay optional', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 50, state: 'Draft' }));
    const { user } = newForm();
    await start(user);
    await user.click(screen.getByRole('button', { name: /Save as draft/ }));
    expect((await saved()).work_hours).toBeNull();
  });

  it('asks for what is missing, and puts the cursor there', async () => {
    const { user } = newForm();
    await start(user);
    await user.type(screen.getByLabelText('Start time'), '09:00');
    await user.click(screen.getByRole('button', { name: /Save as draft/ }));
    expect(screen.getByText('Choose the start and end time, or tick 24 hours.')).toBeInTheDocument();
    expect(screen.getByLabelText('Start time')).toHaveFocus();
    await user.type(screen.getByLabelText('End time'), '17:00');
    expect(screen.getByText('Tick the days the works take place.')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Mon'));
    expect(screen.queryByText('Tick the days the works take place.')).not.toBeInTheDocument();
    expect(api.saveAdvisory).not.toHaveBeenCalled();
  });

  it('refuses the same start and end time', async () => {
    const { user } = newForm();
    await start(user);
    await user.type(screen.getByLabelText('Start time'), '09:00');
    await user.type(screen.getByLabelText('End time'), '09:00');
    await user.click(screen.getByRole('button', { name: 'Every day' }));
    await user.click(screen.getByRole('button', { name: /Save as draft/ }));
    expect(screen.getByText(/The start and end time are the same/)).toBeInTheDocument();
    expect(api.saveAdvisory).not.toHaveBeenCalled();
  });

  it('opens saved hours in the pickers, and Clear hours removes them', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 4 }));
    const { user } = await editForm(advisory({ id: 4, title: 'Piling', work_hours: '9:00 am – 5:00 pm, Mon–Sat' }));
    expect(screen.getByLabelText('Start time')).toHaveValue('09:00');
    expect(screen.getByLabelText('End time')).toHaveValue('17:00');
    expect(screen.getByLabelText('Sat')).toBeChecked();
    expect(screen.getByLabelText('Sun')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Clear hours' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await saved()).work_hours).toBeNull();
  });

  it('keeps hours written the old way until staff replace or remove them', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 5 }));
    const { user } = await editForm(advisory({ id: 5, title: 'Deliveries', work_hours: 'Deliveries 7 am to 10 am' }));
    expect(screen.getByText(/Saved earlier as “Deliveries 7 am to 10 am”/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await saved()).work_hours).toBe('Deliveries 7 am to 10 am');
  });

  it('opening an advisory with saved hours is not an unsaved change', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { user } = await editForm(advisory({ id: 4, title: 'Piling', work_hours: '24 hours, Every day' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

describe('Advisory page: works happening now', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: at('2026-11-13', '23:00') }); }); // Friday, 11 pm

  it('says so while the works are going on', async () => {
    api.getAdvisory.mockResolvedValue(advisory({ id: 1, starts_on: '2026-11-01', ends_on: '2026-12-31', work_hours: '10:00 pm – 6:00 am, Mon–Fri' }));
    renderPage(<AdvisoryPage />, { path: '/advisories/:id', at: '/advisories/1' });
    expect(await screen.findByText('Works happening now')).toBeInTheDocument();
    expect(screen.getByText('10:00 pm – 6:00 am, Mon–Fri')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('not outside the hours, before the start date, or when the hours are written another way', async () => {
    for (const o of [
      { work_hours: '9:00 am – 5:00 pm, Mon–Fri' },
      { work_hours: '10:00 pm – 6:00 am, Mon–Fri', starts_on: '2026-11-20' },
      { work_hours: 'Nightly' },
    ]) {
      api.getAdvisory.mockResolvedValue(advisory({ id: 2, ends_on: '2026-12-31', ...o }));
      const { unmount } = renderPage(<AdvisoryPage />, { path: '/advisories/:id', at: '/advisories/2' });
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByText('Works happening now')).not.toBeInTheDocument();
      unmount();
    }
    vi.useRealTimers();
  });
});
