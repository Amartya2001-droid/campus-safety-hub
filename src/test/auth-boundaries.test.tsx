import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function SessionProbe() {
  const { user, loading, login, logout } = useAuth();
  const client = useQueryClient();
  return <>
    <span>{loading ? 'loading' : user?.name || 'signed out'}</span>
    <button onClick={() => { client.setQueryData(['private-patrol'], 'old account data'); }}>seed</button>
    <button onClick={() => void logout()}>logout</button>
    <button onClick={() => void login('fixture@example.invalid', 'unused mock value', 'student')}>login</button>
  </>;
}
afterEach(() => vi.unstubAllGlobals());

test.each(['logout', 'login'])('%s clears cached data from the previous account', async action => {
  const reply = (data:unknown) => new Response(JSON.stringify(data),{status:200});
  vi.stubGlobal('fetch',vi.fn(async (url:string) => reply(url==='/api/logout' ? {} : {id:url==='/api/me'?1:2,name:'Fixture',role:'student'})));
  const client = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  render(<QueryClientProvider client={client}><AuthProvider><SessionProbe /></AuthProvider></QueryClientProvider>);
  await screen.findByText('Fixture');
  fireEvent.click(screen.getByText('seed'));
  expect(client.getQueryData(['private-patrol'])).toBe('old account data');
  await act(async () => { fireEvent.click(screen.getByText(action)); });
  await vi.waitFor(() => expect(client.getQueryData(['private-patrol'])).toBeUndefined());
});
