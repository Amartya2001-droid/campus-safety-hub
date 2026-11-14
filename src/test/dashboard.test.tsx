import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import Index from '@/pages/Index';
import type { ReactNode } from 'react';

vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
afterEach(() => vi.unstubAllGlobals());
function dashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Index /></MemoryRouter></QueryClientProvider>);
}

test('failed summary does not show zero metrics; Retry renders real counts and configuration status', async () => {
  let calls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/dashboard/stats') {
      calls++;
      return new Response(JSON.stringify(calls === 1 ? { message: 'Unavailable' } : {
        active_alerts: 7, pending_escorts: 4, active_patrols: 2, starrez_configured: true,
      }), { status: calls === 1 ? 503 : 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  dashboard();
  expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard summary unavailable');
  expect(screen.queryByTestId('dashboard-summary')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  const summary = within(await screen.findByTestId('dashboard-summary'));
  expect(summary.getByText('7')).toBeInTheDocument();
  expect(summary.getByText('4')).toBeInTheDocument();
  expect(summary.getByText('2')).toBeInTheDocument();
  expect(summary.getByText('Configured')).toBeInTheDocument();
  expect(summary.queryByText('Connected')).not.toBeInTheDocument();
});

test.each([401, 200])('unauthorized or malformed summary (%i) is not treated as empty data', async status => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
    url === '/api/dashboard/stats' ? '{}' : '[]',
    { status: url === '/api/dashboard/stats' ? status : 200, headers: { 'Content-Type': 'application/json' } },
  )));
  dashboard();
  expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard summary unavailable');
  expect(screen.queryByTestId('dashboard-summary')).not.toBeInTheDocument();
});
