import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import AppRoutes from '../src/AppRoutes';
import ReloadButton from '../src/components/ReloadButton';

const auth = vi.hoisted(() => ({
  user: { id: 'cadet-1', email: 'cadet@example.test', user_metadata: { full_name: 'Ahmad Bilal' } },
  loading: false, configured: true, signOut: vi.fn(), refreshUser: vi.fn(),
}));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }));

function open(path = '/dashboard') {
  const router = { state: {}, navigate: null };
  function LocationProbe() {
    router.state.location = useLocation();
    router.navigate = useNavigate();
    return null;
  }
  render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <LocationProbe /><AppRoutes />
  </MemoryRouter>);
  return router;
}
beforeEach(() => {
  window.scrollTo = vi.fn();
  localStorage.clear();
  auth.loading = false;
  auth.user = { id: 'cadet-1', email: 'cadet@example.test', user_metadata: { full_name: 'Ahmad Bilal' } };
  auth.refreshUser.mockReset().mockResolvedValue(undefined);
  auth.signOut.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

test.each([
  ['Verbal Intelligence', 'verbal'],
  ['Non-Verbal Intelligence', 'nonverbal'],
  ['Academic Preparation', 'academic'],
])('sidebar %s opens the correct test introduction', async (title, category) => {
  const router = open();
  const nav = screen.getByRole('navigation', { name: 'Workspace navigation' });
  await userEvent.click(within(nav).getByRole('link', { name: title }));
  expect(router.state.location.pathname).toBe(`/test/${category}`);
  expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
});

test('signed-in Home navigation and browser Back refresh the dashboard without showing the landing page', async () => {
  const router = open();
  await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(1));
  const nav = screen.getByRole('navigation', { name: 'Workspace navigation' });
  expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByText('Overview')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Your training at a glance' })).toBeNull();
  window.scrollTo.mockClear();
  await userEvent.click(within(nav).getByRole('link', { name: 'Home' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  expect(screen.queryByRole('heading', { name: /Train your mind/ })).toBeNull();
  expect(screen.getByRole('heading', { name: /Welcome, Ahmad/ })).toBeTruthy();
  await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(2));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  await act(() => router.navigate('/test/verbal'));
  await screen.findByRole('heading', { name: 'Verbal Intelligence' });
  await act(() => router.navigate(-1));
  expect(screen.getByRole('heading', { name: /Welcome, Ahmad/ })).toBeTruthy();
  await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(3));
});

test('signed-out home shows the public landing page and account links', () => {
  auth.user = null;
  const router = open('/');
  expect(router.state.location.pathname).toBe('/');
  expect(screen.getByRole('heading', { name: /Train your mind/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Get started' }).getAttribute('href')).toBe('/signup');
  expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).toBeNull();
});

test('opening home with an existing session redirects directly to the dashboard', async () => {
  const router = open('/');
  expect(screen.queryByRole('heading', { name: /Train your mind/ })).toBeNull();
  await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  expect(screen.getByRole('heading', { name: /Welcome, Ahmad/ })).toBeTruthy();
  await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(1));
});

test('home waits for session restoration before choosing the signed-in home page', async () => {
  auth.loading = true;
  const router = open('/');
  expect(screen.getByText(/Checking your session/)).toBeTruthy();
  expect(screen.queryByRole('heading', { name: /Train your mind|Welcome, Ahmad/ })).toBeNull();
  expect(auth.refreshUser).not.toHaveBeenCalled();
  auth.loading = false;
  await act(() => router.navigate('/', { replace: true }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  expect(screen.getByRole('heading', { name: /Welcome, Ahmad/ })).toBeTruthy();
});

test('signing out returns to the public landing page', async () => {
  auth.signOut.mockImplementationOnce(async () => { auth.user = null; });
  const router = open();
  await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Sign out' })); });
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  expect(await screen.findByRole('heading', { name: /Train your mind/ }, { timeout: 5000 })).toBeTruthy();
});

test('Home clears stale dashboard state even when already on the dashboard', async () => {
  auth.signOut.mockRejectedValueOnce(new Error('Sign out failed'));
  open();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Sign out failed')).toBeTruthy();
  await userEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(screen.queryByText('Sign out failed')).toBeNull();
  await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(2));
});

test('Refresh loads new account data without changing the route and prevents duplicate clicks', async () => {
  auth.user = null;
  const router = open('/');
  render(<ReloadButton />);
  await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(1));
  let finishRefresh;
  auth.refreshUser.mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(screen.getByRole('button', { name: 'Refreshing…' }).disabled).toBe(true);
  await act(async () => { finishRefresh(); });
  expect(screen.getByRole('button', { name: 'Refresh' }).disabled).toBe(false);
  expect(router.state.location.pathname).toBe('/');
  expect(auth.refreshUser).toHaveBeenCalledTimes(2);
});

test('a failed manual refresh shows an error and can be retried', async () => {
  auth.user = null;
  open('/');
  render(<ReloadButton />);
  await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(1));
  auth.refreshUser.mockRejectedValueOnce(new Error('Offline'));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});

test('a failed navigation refresh leaves the page usable and provides a retry', async () => {
  auth.refreshUser.mockRejectedValueOnce(new Error('Offline'));
  open('/dashboard');
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Verbal Intelligence' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});

test('protected test routes redirect signed-out users to login', async () => {
  auth.user = null;
  const router = open('/test/verbal');
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  expect(screen.getByRole('button', { name: /Log in to dashboard/ })).toBeTruthy();
});

test('answering a practice question keeps the active paper and does not trigger a route refresh', async () => {
  const router = open('/test/verbal');
  await userEvent.click(await screen.findByRole('button', { name: /Start 30-minute test/ }));
  expect(screen.getByRole('heading', { name: /Question 1/ })).toBeTruthy();
  const saved = JSON.parse(localStorage.getItem('cadetprep:cadet-1:verbal'));
  window.scrollTo.mockClear();
  await userEvent.click(document.querySelector('.exam-option'));
  const updated = JSON.parse(localStorage.getItem('cadetprep:cadet-1:verbal'));
  expect(updated.id).toBe(saved.id);
  expect(updated.status).toBe('running');
  expect(updated.answers[0]).toBe(0);
  expect(router.state.location.pathname).toBe('/test/verbal');
  expect(auth.refreshUser).not.toHaveBeenCalled();
  expect(window.scrollTo).not.toHaveBeenCalled();
});
