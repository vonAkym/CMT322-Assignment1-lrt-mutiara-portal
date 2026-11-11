// Module 1 pages: Home, Advisories (filters), advisory cards, zone alerts and the urgent banner.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { advisory, renderPage } from './helpers/render.jsx';

vi.mock('../../src/shared/supabase.js', async (orig) => {
  const { SAMPLE_ZONES } = await import('./helpers/render.jsx');
  return { ...(await orig()), listZones: async () => SAMPLE_ZONES };
});
vi.mock('../../src/modules/advisories/api.js', async (orig) => ({
  ...(await orig()),
  listAdvisories: vi.fn(async () => []), hubSummary: vi.fn(), listUrgent: vi.fn(async () => []), subscribeToZone: vi.fn(),
}));
const api = await import('../../src/modules/advisories/api.js');
const { default: HomePage } = await import('../../src/modules/advisories/HomePage.jsx');
const { default: AdvisoriesPage } = await import('../../src/modules/advisories/AdvisoriesPage.jsx');
const { default: AdvisoryCard } = await import('../../src/modules/advisories/AdvisoryCard.jsx');
const { default: ZoneAlerts } = await import('../../src/modules/advisories/ZoneAlerts.jsx');
const { default: UrgentBanner } = await import('../../src/modules/advisories/UrgentBanner.jsx');

beforeEach(() => { vi.clearAllMocks(); api.listAdvisories.mockResolvedValue([]); });

describe('Home page (UC01)', () => {
  const SUMMARY = { closures: 2, active: 5, urgent: 1, thisWeek: 4, latest: [advisory({ id: 7, title: 'Komtar detour' })] };

  it('shows today’s numbers and the latest advisories', async () => {
    api.hubSummary.mockResolvedValue(SUMMARY);
    renderPage(<HomePage />);
    const closures = await screen.findByRole('button', { name: /Active road closures/ });
    expect(closures).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Ongoing advisories/ })).toHaveTextContent('5');
    expect(screen.getByRole('link', { name: 'Komtar detour' })).toHaveAttribute('href', '/advisories/7');
  });

  it('each number opens the advisories behind it', async () => {
    api.hubSummary.mockResolvedValue(SUMMARY);
    const { user } = renderPage(<HomePage />);
    await user.click(await screen.findByRole('button', { name: /Urgent alerts/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/advisories?urgent=1');
  });

  it('the search box opens Advisories with the words and area', async () => {
    api.hubSummary.mockResolvedValue(SUMMARY);
    const { user } = renderPage(<HomePage />);
    await user.type(screen.getByLabelText('Search advisories'), 'Jalan Magazine');
    await screen.findByRole('option', { name: 'Jelutong' });
    await user.selectOptions(screen.getByLabelText('Area'), 'Jelutong');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/advisories?q=Jalan+Magazine&zone=2');
  });

  it('still shows the page when the numbers cannot load', async () => {
    api.hubSummary.mockRejectedValue(new Error('offline'));
    renderPage(<HomePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Know the works before you go' })).toBeInTheDocument();
    await waitFor(() => expect(api.hubSummary).toHaveBeenCalled());
  });
});

describe('Advisories page (UC03)', () => {
  it('reads the filters from the address and asks the database for them', async () => {
    renderPage(<AdvisoriesPage />, { path: '/advisories', at: '/advisories?q=pile&zone=1&category=Road+closure&status=Ongoing&date=2026-11-20&urgent=1' });
    await waitFor(() => expect(api.listAdvisories).toHaveBeenCalledWith({
      q: 'pile', zoneId: '1', category: 'Road closure', onDate: '2026-11-20', status: 'Ongoing', ended: false, urgent: true,
    }));
    expect(screen.getByLabelText('Search')).toHaveValue('pile');
    expect(screen.getByLabelText('Urgent only')).toBeChecked();
  });

  it('“Ended (archive)” asks for the archive', async () => {
    renderPage(<AdvisoriesPage />, { path: '/advisories', at: '/advisories?status=ended' });
    await waitFor(() => expect(api.listAdvisories).toHaveBeenCalledWith(expect.objectContaining({ ended: true, status: '' })));
  });

  it('changing a filter updates the address', async () => {
    const { user } = renderPage(<AdvisoriesPage />, { path: '/advisories' });
    await user.selectOptions(screen.getByLabelText('Type'), 'Business access');
    expect(screen.getByTestId('where')).toHaveTextContent('/advisories?category=Business+access');
    await user.click(screen.getByLabelText('Urgent only'));
    expect(screen.getByTestId('where')).toHaveTextContent('urgent=1');
  });

  it('waits until typing stops before searching', async () => {
    const { user } = renderPage(<AdvisoriesPage />, { path: '/advisories' });
    await user.type(screen.getByLabelText('Search'), 'Komtar');
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/advisories$/);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/advisories?q=Komtar'));
  });

  it('Clear filters empties every filter', async () => {
    const { user } = renderPage(<AdvisoriesPage />, { path: '/advisories', at: '/advisories?q=x&status=Ongoing' });
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/advisories$/);
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('shows how many advisories match, or that none do', async () => {
    api.listAdvisories.mockResolvedValue([advisory({ id: 1 }), advisory({ id: 2, title: 'Second' })]);
    renderPage(<AdvisoriesPage />, { path: '/advisories' });
    expect(await screen.findByText('2 advisories')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('says when nothing matches, and when loading fails', async () => {
    renderPage(<AdvisoriesPage />, { path: '/advisories' });
    expect(await screen.findByText('No advisories match these filters.')).toBeInTheDocument();
  });
  it('says when loading fails', async () => {
    api.listAdvisories.mockRejectedValue(new Error('offline'));
    renderPage(<AdvisoriesPage />, { path: '/advisories' });
    expect(await screen.findByText('Could not load advisories. Please try again later.')).toBeInTheDocument();
  });
});

describe('Advisory card', () => {
  it('shows Urgent and the status for a current high-severity advisory', () => {
    renderPage(<AdvisoryCard a={advisory({ severity: 'High', status: 'Ongoing' })} />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('Urgent')).toBeInTheDocument();
    expect(within(card).getByText('Ongoing')).toBeInTheDocument();
    expect(within(card).getByText('1 Nov – 31 Dec 2026')).toBeInTheDocument();
  });
  it('shows Ended, without Urgent, once the end date has passed', () => {
    renderPage(<AdvisoryCard a={advisory({ severity: 'High', ends_on: '2020-01-01', starts_on: '2019-12-01' })} />);
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
  });
  it('does not show Urgent yet for high-severity works that start more than 3 days from now', () => {
    const start = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    renderPage(<AdvisoryCard a={advisory({ severity: 'High', status: 'Planned', starts_on: start, ends_on: null })} />);
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
  });
  it('uses the first photo, or an icon when there is none', () => {
    const { container, unmount } = renderPage(<AdvisoryCard a={advisory({ photo_paths: ['assets/img/hero.jpg'] })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'assets/img/hero.jpg');
    unmount();
    const r = renderPage(<AdvisoryCard a={advisory()} />);
    expect(r.container.querySelector('.acard-ph')).toBeInTheDocument();
  });
});

describe('Zone alerts', () => {
  it('asks for an area and a valid email first', async () => {
    const { user } = renderPage(<ZoneAlerts />);
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(screen.getByText('Choose an area.')).toBeInTheDocument();
    expect(screen.getByText('Enter an email address, e.g. name@example.com.')).toBeInTheDocument();
    expect(screen.getByLabelText('Area')).toHaveFocus();
    expect(api.subscribeToZone).not.toHaveBeenCalled();
  });

  it('subscribes and confirms with the area name', async () => {
    api.subscribeToZone.mockResolvedValue('added');
    const { user } = renderPage(<ZoneAlerts />);
    await screen.findByRole('option', { name: 'George Town' });
    await user.selectOptions(screen.getByLabelText('Area'), 'George Town');
    await user.type(screen.getByLabelText('Email'), 'ali@example.com');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Subscribed. Alerts for George Town will go to ali@example.com.');
    expect(api.subscribeToZone).toHaveBeenCalledWith('1', 'ali@example.com');
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('says when the email already follows that area', async () => {
    api.subscribeToZone.mockResolvedValue('already');
    const { user } = renderPage(<ZoneAlerts />);
    await screen.findByRole('option', { name: 'Jelutong' });
    await user.selectOptions(screen.getByLabelText('Area'), 'Jelutong');
    await user.type(screen.getByLabelText('Email'), 'ali@example.com');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('ali@example.com is already subscribed to Jelutong.');
  });

  it('shows an error when saving fails', async () => {
    api.subscribeToZone.mockRejectedValue(new Error('offline'));
    const { user } = renderPage(<ZoneAlerts />);
    await screen.findByRole('option', { name: 'Jelutong' });
    await user.selectOptions(screen.getByLabelText('Area'), 'Jelutong');
    await user.type(screen.getByLabelText('Email'), 'ali@example.com');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not subscribe. Please try again later.');
  });
});

describe('Urgent banner (UC05)', () => {
  it('shows nothing when there are no urgent advisories', async () => {
    const { container } = renderPage(<UrgentBanner />);
    await waitFor(() => expect(api.listUrgent).toHaveBeenCalled());
    expect(container.querySelector('.ubar')).toBeNull();
  });

  it('lists each urgent advisory as a link, once for screen readers', async () => {
    api.listUrgent.mockResolvedValue([advisory({ id: 3, title: 'Full closure of Sample Road A', severity: 'High' })]);
    renderPage(<UrgentBanner />);
    const region = await screen.findByRole('region', { name: 'Urgent alerts' });
    expect(within(region).getByRole('link', { name: /Full closure of Sample Road A/ })).toHaveAttribute('href', '/advisories/3');
  });

  it('× hides it for this tab, until the urgent list changes', async () => {
    const list = [advisory({ id: 3, severity: 'High' })];
    api.listUrgent.mockResolvedValue(list);
    const { user, unmount } = renderPage(<UrgentBanner />);
    const region = await screen.findByRole('region', { name: 'Urgent alerts' });
    await user.click(within(region).getByRole('button'));
    expect(screen.queryByRole('region', { name: 'Urgent alerts' })).not.toBeInTheDocument();
    unmount();

    renderPage(<UrgentBanner />); // same list: stays hidden
    await act(async () => {});
    expect(screen.queryByRole('region', { name: 'Urgent alerts' })).not.toBeInTheDocument();

    api.listUrgent.mockResolvedValue([...list, advisory({ id: 4, severity: 'High' })]);
    renderPage(<UrgentBanner />); // a new urgent advisory: shown again
    expect(await screen.findByRole('region', { name: 'Urgent alerts' })).toBeInTheDocument();
  });
});
