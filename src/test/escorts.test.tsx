import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import Escorts from '@/pages/Escorts';

const auth = vi.hoisted(() => ({ user: { id:3, name:'Fixture Staff', role:'student' } }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children:ReactNode }) => <main>{children}</main> }));
beforeEach(() => { auth.user = { id:3,name:'Fixture Staff',role:'student' }; toast.mockClear(); });
afterEach(() => vi.unstubAllGlobals());
const fixture = { id:7,student_name:'Fixture owner',pickup:'Test pickup',destination:'Test destination',
  notes:null,status:'pending',assigned_officer:null,eta:null,created_at:'2026-11-16T12:00:00Z' };
function reply(data: unknown, status=200) { return new Response(JSON.stringify(data),{ status,headers:{'Content-Type':'application/json'} }); }
function queue(seed?: (client:QueryClient) => void) {
  const client = new QueryClient({ defaultOptions:{queries:{retry:false,gcTime:0}} });
  seed?.(client);
  render(<QueryClientProvider client={client}><Escorts /></QueryClientProvider>);
}

test('failed queue offers Retry instead of an empty result and students cannot manage status', async () => {
  let calls=0;
  vi.stubGlobal('fetch',vi.fn(async () => ++calls===1 ? reply({},503) : reply([fixture])));
  queue();
  expect(await screen.findByRole('alert')).toHaveTextContent('Escort requests unavailable');
  expect(screen.queryByTestId('text-no-escorts')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByTestId('card-escort-7')).toHaveTextContent('Fixture owner');
  expect(screen.queryByTestId('button-assign-escort-7')).not.toBeInTheDocument();
});

test('staff assignment uses the authenticated name without an invented ETA', async () => {
  auth.user.role='admin';
  let assigned=false;
  const fetch = vi.fn(async (_url:string, options?:RequestInit) => {
    if (options?.method==='PATCH') {
      expect(JSON.parse(options.body as string)).toEqual({status:'assigned',assigned_officer:'Fixture Staff'});
      assigned=true;
      return reply({...fixture,status:'assigned',assigned_officer:'Fixture Staff'});
    }
    return reply([{...fixture,...(assigned?{status:'assigned',assigned_officer:'Fixture Staff'}:{})}]);
  });
  vi.stubGlobal('fetch',fetch);
  queue();
  fireEvent.click(await screen.findByTestId('button-assign-escort-7'));
  expect(await screen.findByTestId('button-start-escort-7')).toBeInTheDocument();
  expect(screen.queryByText(/ETA:/)).not.toBeInTheDocument();
  expect(screen.queryByText('Officer on duty')).not.toBeInTheDocument();
});

test('status failure leaves the request unchanged and surfaces the backend error', async () => {
  auth.user.role='admin';
  vi.stubGlobal('fetch',vi.fn(async (_url:string, options?:RequestInit) =>
    options?.method==='PATCH' ? reply({message:'Staff update unavailable'},503) : reply([fixture])));
  queue();
  fireEvent.click(await screen.findByTestId('button-assign-escort-7'));
  await vi.waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({description:'Staff update unavailable'})));
  expect(screen.getByTestId('button-assign-escort-7')).toBeInTheDocument();
});

test.each([401,200])('unauthorized or malformed queue (%i) cannot appear empty', async status => {
  vi.stubGlobal('fetch',vi.fn(async () => reply({},status)));
  queue();
  expect(await screen.findByRole('alert')).toHaveTextContent('Escort requests unavailable');
  expect(screen.queryByTestId('text-no-escorts')).not.toBeInTheDocument();
});

test('another account cache cannot populate the private queue', async () => {
  let release:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async () => new Promise<Response>(resolve => {release=resolve;})));
  queue(client => {
    client.setQueryData(['/api/escort-requests'],[fixture]);
    client.setQueryData(['/api/escort-requests',99,'admin'],[fixture]);
  });
  expect(screen.queryByTestId('card-escort-7')).not.toBeInTheDocument();
  await act(async () => {release(reply([]));});
  expect(await screen.findByTestId('text-no-escorts')).toBeInTheDocument();
});
