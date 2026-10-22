import { afterEach, expect, test, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mounted = vi.hoisted(() => ({ root: null }));
const auth = vi.hoisted(() => ({
  user: null, loading: false, configured: true, passwordRecovery: false,
  refreshUser: vi.fn().mockResolvedValue(undefined), completePasswordRecovery: vi.fn(),
}));
vi.mock('react-dom/client', async importOriginal => {
  const original = await importOriginal();
  return { ...original, createRoot: (...args) => {
    mounted.root = original.createRoot(...args);
    return mounted.root;
  } };
});
vi.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => auth,
}));
vi.mock('../src/lib/supabase', () => ({ supabase: null, createRegistrationClient: vi.fn() }));

afterEach(async () => {
  if (mounted.root) await act(async () => mounted.root.unmount());
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

test('the actual app entry point mounts home, login, and email-code recovery routes', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  window.history.replaceState({}, '', '/');
  window.scrollTo = vi.fn();
  await act(async () => { await import('../src/main.jsx'); });
  expect(await screen.findByRole('heading', { name: /Train your mind/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  expect(screen.getAllByRole('link', { name: /View past papers for/ })).toHaveLength(3);
  await userEvent.click(screen.getByRole('link', { name: 'Log in', exact: true }));
  expect(await screen.findByRole('heading', { name: 'Welcome back, cadet.' })).toBeTruthy();
  await userEvent.click(screen.getByRole('link', { name: 'Forgot password?' }));
  expect(await screen.findByRole('heading', { name: 'Forgot your password?' })).toBeTruthy();
  expect(window.location.pathname).toBe('/reset-password');
  expect(screen.getByRole('button', { name: 'Send verification code' })).toBeTruthy();
  expect(screen.queryByLabelText('Current password')).toBeNull();
});
