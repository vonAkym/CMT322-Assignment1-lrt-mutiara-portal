// Module 1: the place of an advisory on the map (feat/advisory-map-location).
// The real maps need a browser (Leaflet), so here they are replaced by simple stand-ins:
// the picker gets buttons that do what a click on the map or a search would do.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { advisory, renderPage } from './helpers/render.jsx';

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
  ...(await orig()),
  LocationPicker: ({ value, onChange, onFound }) => (
    <div>
      <p>Picker pin: {value ? `${value.lat},${value.lng}` : 'none'}</p>
      <button type="button" onClick={() => onChange({ lat: 5.4141, lng: 100.3288 })}>Click the map</button>
      <button type="button" onClick={() => { onChange({ lat: 5.4145, lng: 100.3292 }); onFound('Komtar'); }}>Search Komtar</button>
      <button type="button" onClick={() => onChange(null)}>Remove pin</button>
    </div>
  ),
  PlaceMap: ({ lat, lng, name }) => <p>Small map: {name} at {lat},{lng}</p>,
}));
const api = await import('../../src/modules/advisories/api.js');
const { mapUrl } = await import('../../src/modules/advisories/AdvisoryMap.jsx');
const { default: AdvisoryPage } = await import('../../src/modules/advisories/AdvisoryPage.jsx');
const { default: ManagePage } = await import('../../src/modules/advisories/ManagePage.jsx');

beforeEach(() => { vi.clearAllMocks(); api.listMyAdvisories.mockResolvedValue([]); });

describe('mapUrl', () => {
  it('points the full map at the pin, with a name and the advisory', () => {
    const url = mapUrl({ id: 7, lat: 5.41, lng: 100.33, location: 'Jalan Magazine', title: 'Lane closure' });
    const q = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/map?')).toBe(true);
    expect([q.get('at'), q.get('name'), q.get('advisory')]).toEqual(['5.41,100.33', 'Jalan Magazine', '7']);
  });
  it('uses the title when there is no location in words', () => {
    expect(new URLSearchParams(mapUrl({ id: 7, lat: 5.41, lng: 100.33, location: null, title: 'Lane closure' }).split('?')[1]).get('name')).toBe('Lane closure');
  });
});

describe('Advisory page (UC02): where the works are', () => {
  it('shows the pin on a small map, with a link to the full map', async () => {
    api.getAdvisory.mockResolvedValue(advisory({ id: 7, lat: 5.41, lng: 100.33, location: 'Jalan Magazine' }));
    const { user } = renderPage(<AdvisoryPage />, { path: '/advisories/:id', at: '/advisories/7' });
    expect(await screen.findByText('Small map: Jalan Magazine at 5.41,100.33')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View on the full disruption map' })).toHaveAttribute('href', expect.stringContaining('/map?at=5.41%2C100.33'));
    await user.click(screen.getByRole('button', { name: 'Open the disruption map' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/map?at=5.41%2C100.33');
  });
  it('has no small map for an advisory without a pin, and opens the whole map', async () => {
    api.getAdvisory.mockResolvedValue(advisory({ id: 8, lat: null, lng: null }));
    const { user } = renderPage(<AdvisoryPage />, { path: '/advisories/:id', at: '/advisories/8' });
    await screen.findByRole('heading', { name: 'Lane closure on Jalan Sample' });
    expect(screen.queryByText(/Small map/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open the disruption map' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/map$/);
  });
});

describe('My advisories (UC06, UC07): pinning the location', () => {
  const fill = async (user) => {
    await user.click(screen.getByRole('button', { name: '+ New advisory' }));
    await user.type(screen.getByLabelText(/^Title/), 'Lane closure');
  };
  const saved = async () => { await waitFor(() => expect(api.saveAdvisory).toHaveBeenCalled()); return api.saveAdvisory.mock.calls[0][1]; };

  it('saves the pin dropped on the map', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 50, state: 'Draft' }));
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Click the map' }));
    expect(screen.getByText('Picker pin: 5.4141,100.3288')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save as draft/ }));
    expect(await saved()).toMatchObject({ lat: 5.4141, lng: 100.3288 });
  });

  it('sends no pin for a new advisory without one (so it saves even before the database has pins)', async () => {
    api.saveAdvisory.mockResolvedValue(advisory({ id: 50, state: 'Draft' }));
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Click the map' }));
    await user.click(screen.getByRole('button', { name: 'Remove pin' }));
    await user.click(screen.getByRole('button', { name: /Save as draft/ }));
    const fields = await saved();
    expect(fields).not.toHaveProperty('lat');
    expect(fields).not.toHaveProperty('lng');
  });

  it('clears the saved pin when staff remove it from an advisory', async () => {
    api.listMyAdvisories.mockResolvedValue([advisory({ id: 4, title: 'Pinned works', lat: 5.41, lng: 100.33 })]);
    api.saveAdvisory.mockResolvedValue(advisory({ id: 4 }));
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await user.click(await screen.findByRole('button', { name: 'Edit: Pinned works' }));
    await user.click(screen.getByRole('button', { name: 'Remove pin' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await saved()).toMatchObject({ lat: null, lng: null });
  });

  it('a place found by the search fills in an empty Location box, but never replaces what staff wrote', async () => {
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await fill(user);
    const where = screen.getByLabelText('Where the works are, in words');
    await user.click(screen.getByRole('button', { name: 'Search Komtar' }));
    expect(where).toHaveValue('Komtar');
    await user.clear(where); await user.type(where, 'Jalan Magazine');
    await user.click(screen.getByRole('button', { name: 'Search Komtar' }));
    expect(where).toHaveValue('Jalan Magazine');
  });

  it('opens an advisory with its saved pin, and moving the pin counts as an unsaved change', async () => {
    api.listMyAdvisories.mockResolvedValue([advisory({ id: 4, title: 'Pinned works', lat: 5.41, lng: 100.33 })]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderPage(<ManagePage />, { path: '/manage' });
    await user.click(await screen.findByRole('button', { name: 'Edit: Pinned works' }));
    expect(screen.getByText('Picker pin: 5.41,100.33')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Click the map' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('marks pinned advisories in the list', async () => {
    api.listMyAdvisories.mockResolvedValue([advisory({ id: 4, title: 'Pinned works', lat: 5.41, lng: 100.33 })]);
    renderPage(<ManagePage />, { path: '/manage' });
    expect(await screen.findByText(/On the map/)).toBeInTheDocument();
  });
});
