import { act, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import CampusMap from '@/pages/CampusMap';

vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, name: 'Fixture', role: 'student' } }) }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  useMap: () => ({ setView: () => {} }),
}));
afterEach(() => vi.unstubAllGlobals());
const fixture = { active_alerts: [{ id: 7,student_name:'Fixture owner',location:'Test location',
  lat:45,lng:-64,type:null,status:'new',created_at:'2026-11-15T12:00:00Z' }], active_patrols:[] };
function map(seed?: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry:false,gcTime:0 } } });
  seed?.(client);
  render(<QueryClientProvider client={client}><CampusMap /></QueryClientProvider>);
  return client;
}
function reply(data: unknown, status=200) {
  return new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json'} });
}

test('overlay failure shows unavailable counts; Retry renders real alerts', async () => {
  let calls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/map/live-data' ?
    (++calls === 1 ? reply({},503) : reply(fixture)) : reply([])));
  map();
  expect(await screen.findByRole('alert')).toHaveTextContent('overlays may be stale');
  expect(screen.getByTestId('toggle-layer-alerts')).toHaveTextContent('Unavailable');
  expect(screen.getByTestId('toggle-layer-patrols')).toHaveTextContent('Unavailable');
  fireEvent.click(screen.getByRole('button', { name:'Retry' }));
  expect(await screen.findByTestId('map-alert-7')).toHaveTextContent('Fixture owner');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByTestId('toggle-layer-alerts')).toHaveTextContent('1');
});

test.each([401,200])('unauthorized or malformed overlays (%i) cannot become a false empty map', async status => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/map/live-data' ? reply({},status) : reply([])));
  map();
  expect(await screen.findByRole('alert')).toHaveTextContent('Live map data unavailable');
  expect(screen.getByTestId('toggle-layer-alerts')).toHaveTextContent('Unavailable');
});

test('failed refresh retains cached alerts with an explicit stale warning', async () => {
  let failed = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/map/live-data' ?
    (failed ? reply({},503) : reply(fixture)) : reply([])));
  const client = map();
  expect(await screen.findByTestId('map-alert-7')).toBeInTheDocument();
  failed = true;
  await act(async () => { await client.refetchQueries({ queryKey:['/api/map/live-data'] }); });
  expect(await screen.findByRole('alert')).toHaveTextContent('overlays may be stale');
  expect(screen.getByTestId('map-alert-7')).toBeInTheDocument();
  expect(screen.getByTestId('live-map-overlays')).toHaveAttribute('data-stale','true');
  expect(screen.getByTestId('toggle-layer-alerts')).toHaveTextContent('Unavailable');
});


test('another account or legacy unscoped cache cannot populate private overlays', async () => {
  let release: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/map/live-data' ?
    new Promise<Response>(resolve => { release = resolve; }) : reply([])));
  map(client => {
    client.setQueryData(['/api/map/live-data'], fixture);
    client.setQueryData(['/api/map/live-data', 99, 'admin'], fixture);
  });
  expect(screen.queryByTestId('map-alert-7')).not.toBeInTheDocument();
  expect(screen.getByTestId('toggle-layer-alerts')).toHaveTextContent('Loading');
  await act(async () => { release(reply({ active_alerts:[], active_patrols:[] })); });
  expect(screen.queryByTestId('map-alert-7')).not.toBeInTheDocument();
});
