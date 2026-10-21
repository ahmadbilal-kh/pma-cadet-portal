import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppRoutes from '../src/AppRoutes';
import { takeRegistrationHandoff } from '../src/lib/registrationHandoff';

const auth = vi.hoisted(() => ({ user: null, configured: true, loading: false, refreshUser: vi.fn(), signOut: vi.fn() }));
const api = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn(), invoke: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: api.signInWithPassword }, functions: { invoke: api.invoke } },
  createRegistrationClient: () => ({ auth: { signUp: api.signUp } }),
}));
let location;
function LocationProbe() { location = useLocation(); return null; }
function open(path = '/signup') {
  return render(<StrictMode><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <LocationProbe /><AppRoutes />
  </MemoryRouter></StrictMode>);
}
async function signup(passwordConfirmation = 'example-test-only') {
  const user = userEvent.setup();
  for (const [placeholder, value] of [
    ['Enter your full name', 'Ahmad Bilal'],
    ['you@example.com', 'CADET@example.test'],
    ['Create a strong password', 'example-test-only'],
    ['Enter your password again', passwordConfirmation],
  ]) {
    await user.click(screen.getByPlaceholderText(placeholder));
    await user.paste(value);
  }
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '3001234567' } });
  await user.click(screen.getByRole('button', { name: 'Send SMS code' }));
  fireEvent.change(await screen.findByLabelText('SMS verification code'), { target: { value: '123456' } });
  await user.click(screen.getByRole('button', { name: 'Verify code' }));
  await screen.findByText('Mobile verified');
  await user.click(screen.getByRole('button', { name: 'Create my account' }));
}
beforeEach(() => {
  auth.user = null; auth.configured = true; auth.loading = false;
  auth.refreshUser.mockReset().mockResolvedValue(undefined);
  api.signUp.mockReset().mockResolvedValue({ data: { user: { id: 'u1', identities: [{}] }, session: null }, error: null });
  api.signInWithPassword.mockReset();
  api.invoke.mockReset().mockImplementation(async (_name, { body }) => ({ data: body.action === 'send' ? { id: '11111111-1111-4111-8111-111111111111', secret: 'a'.repeat(64), expiresAt: Date.now()+600000 } : { verified: true, phone: '+923001234567' }, error: null }));
  takeRegistrationHandoff(); localStorage.clear(); sessionStorage.clear();
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

test.each([true, false])('signup prefills login in StrictMode (email confirmation required: %s)', async confirmationRequired => {
  api.signUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [{}] }, session: confirmationRequired ? null : { access_token: 'test' } }, error: null });
  open();
  await signup();
  await screen.findByRole('heading', { name: 'Welcome back, cadet.' });
  expect(location.pathname).toBe('/login');
  await waitFor(() => expect(screen.getByPlaceholderText('you@example.com').value).toBe('cadet@example.test'));
  await waitFor(() => expect(screen.getByPlaceholderText('Enter your password').value).toBe('example-test-only'));
  expect(screen.getByRole('status').textContent).toContain(confirmationRequired ? 'Confirm your email' : 'Account created successfully');
  expect(api.signInWithPassword).not.toHaveBeenCalled();
  expect(JSON.stringify(location.state)).not.toContain('example-test-only');
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('example-test-only');
  expect(takeRegistrationHandoff()).toBeNull();
});

test('reopening login after signup clears the one-use password prefill', async () => {
  const view = open();
  await signup();
  await waitFor(() => expect(screen.getByPlaceholderText('Enter your password').value).toBe('example-test-only'));
  view.unmount();
  open('/login');
  expect(screen.getByPlaceholderText('Enter your password').value).toBe('');
});

test('password mismatch stays on signup without creating an account', async () => {
  open();
  await signup('different-password');
  expect(screen.getByRole('alert').textContent).toContain('Passwords do not match');
  expect(location.pathname).toBe('/signup');
  expect(api.signUp).not.toHaveBeenCalled();
});

test('email rate limit keeps signup data and does not prefill login', async () => {
  api.signUp.mockResolvedValue({ data: null, error: { code: 'over_email_send_rate_limit' } });
  open();
  await signup();
  expect(screen.getByRole('alert').textContent).toContain('sending limit has been reached');
  expect(location.pathname).toBe('/signup');
  expect(screen.getByPlaceholderText('Enter your full name').value).toBe('Ahmad Bilal');
  expect(takeRegistrationHandoff()).toBeNull();
});

test('pending signup disables repeated submission until the service responds', async () => {
  let complete;
  api.signUp.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  open();
  await signup();
  const submit = screen.getByRole('button', { name: /Please wait/ });
  expect(submit.disabled).toBe(true);
  await userEvent.click(submit);
  expect(api.signUp).toHaveBeenCalledTimes(1);
  await act(async () => { complete({ data: null, error: new Error('Try later') }); });
  expect(screen.getByRole('button', { name: 'Create my account' }).disabled).toBe(false);
});

test('wrong login credentials show an error and keep the user on login', async () => {
  api.signInWithPassword.mockResolvedValue({ data: null, error: { code: 'invalid_credentials' } });
  open('/login');
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'cadet@example.test');
  await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'wrong-password');
  await userEvent.click(screen.getByRole('button', { name: 'Log in to dashboard' }));
  expect(screen.getByRole('alert').textContent).toContain('Invalid email or password');
  expect(location.pathname).toBe('/login');
});

test('signup credentials can be submitted from the prefilled login to reach the dashboard', async () => {
  api.signInWithPassword.mockImplementation(async () => {
    auth.user = { id: 'u1', email: 'cadet@example.test', user_metadata: { full_name: 'Ahmad Bilal' } };
    return { data: { user: auth.user, session: { access_token: 'test' } }, error: null };
  });
  open();
  await signup();
  await waitFor(() => expect(screen.getByPlaceholderText('Enter your password').value).toBe('example-test-only'));
  await userEvent.click(await screen.findByRole('button', { name: 'Log in to dashboard' }));
  await waitFor(() => expect(location.pathname).toBe('/dashboard'));
  expect(screen.getByRole('heading', { name: /Welcome, Ahmad/ })).toBeTruthy();
  expect(api.signInWithPassword).toHaveBeenCalledWith({ email: 'cadet@example.test', password: 'example-test-only' });
});
