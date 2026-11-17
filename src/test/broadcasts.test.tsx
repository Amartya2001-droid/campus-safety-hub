import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import Broadcast from '@/pages/Broadcast';

const auth = vi.hoisted(() => ({user:{id:3,name:'Fixture Staff',role:'student'}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/components/DashboardLayout',()=>({DashboardLayout:({children}:{children:ReactNode})=><main>{children}</main>}));
beforeEach(()=>{auth.user={id:3,name:'Fixture Staff',role:'student'};});
afterEach(()=>vi.unstubAllGlobals());
const fixture={id:7,type:'general',title:'Fixture announcement',message:'Dashboard fixture',
  sent_by:'Fixture Staff',priority:'normal',target:'All Users',created_at:'2026-11-17T12:00:00Z'};
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
function feed(seed?:(client:QueryClient)=>void){
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  seed?.(client);
  render(<QueryClientProvider client={client}><Broadcast/></QueryClientProvider>);
}

test('readers see announcements but no publication form',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>reply([fixture])));
  feed();
  expect(await screen.findByTestId('card-broadcast-7')).toHaveTextContent('Fixture announcement');
  expect(screen.queryByTestId('button-send-broadcast')).not.toBeInTheDocument();
  expect(screen.getByText(/Only staff can publish/)).toBeInTheDocument();
});

test('feed errors offer Retry instead of a false empty feed',async()=>{
  let calls=0;
  vi.stubGlobal('fetch',vi.fn(async()=>++calls===1?reply({},503):reply([fixture])));
  feed();
  expect(await screen.findByRole('alert')).toHaveTextContent('Broadcast feed unavailable');
  expect(screen.queryByTestId('text-no-broadcasts')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(await screen.findByTestId('card-broadcast-7')).toBeInTheDocument();
});

test.each([401,200])('unauthorized or malformed data (%i) is not an empty feed',async status=>{
  vi.stubGlobal('fetch',vi.fn(async()=>reply({},status)));
  feed();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByTestId('text-no-broadcasts')).not.toBeInTheDocument();
});

test('staff publication copy describes dashboard storage without push promises',async()=>{
  auth.user.role='admin';
  vi.stubGlobal('fetch',vi.fn(async()=>reply([])));
  feed();
  expect(await screen.findByTestId('text-no-broadcasts')).toBeInTheDocument();
  expect(screen.getByText('Dashboard feed only; device push delivery is not configured.')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Publish Broadcast'})).toBeDisabled();
  expect(screen.queryByText('Send Broadcast')).not.toBeInTheDocument();
});

test('another account or unscoped cache cannot expose legacy targeted messages',async()=>{
  let release:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async()=>new Promise<Response>(resolve=>{release=resolve;})));
  feed(client=>{
    client.setQueryData(['/api/broadcast-alerts'],[{...fixture,target:'Faculty'}]);
    client.setQueryData(['/api/broadcast-alerts',99,'admin'],[{...fixture,target:'Faculty'}]);
  });
  expect(screen.queryByTestId('card-broadcast-7')).not.toBeInTheDocument();
  await act(async()=>{release(reply([]));});
  expect(await screen.findByTestId('text-no-broadcasts')).toBeInTheDocument();
});
