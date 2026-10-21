import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppRoutes from '../src/AppRoutes';

const auth = vi.hoisted(() => ({ user: null, loading: false, configured: true, passwordRecovery: false, completePasswordRecovery: vi.fn(), refreshUser: vi.fn(), signOut: vi.fn() }));
const api = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: api } }));
let location;
function LocationProbe() { location = useLocation(); return null; }
function open(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LocationProbe /><AppRoutes /></MemoryRouter>);
}
async function paste(placeholder, value) {
  const user = userEvent.setup();
  await user.click(screen.getByPlaceholderText(placeholder)); await user.paste(value);
}
async function setPasswords(password = 'new-test-password', confirmation = password) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('New password', { exact: true })); await user.paste(password);
  await user.click(screen.getByLabelText('Confirm new password', { exact: true })); await user.paste(confirmation);
}
beforeEach(() => {
  auth.user = null; auth.loading = false; auth.configured = true; auth.passwordRecovery = false;
  auth.completePasswordRecovery.mockReset().mockImplementation(() => { auth.passwordRecovery = false; });
  auth.refreshUser.mockReset().mockResolvedValue(undefined);
  api.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  api.updateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  api.verifyOtp.mockReset();
  auth.signOut.mockReset().mockImplementation(async () => { auth.user = null; auth.passwordRecovery = false; });
  window.scrollTo = vi.fn(); localStorage.clear(); sessionStorage.clear();
});
afterEach(cleanup);

test('Forgot password opens email recovery without a current password field', async () => {
  open();
  await userEvent.click(screen.getByRole('link', { name: 'Forgot password?' }));
  expect(await screen.findByRole('heading', { name: 'Forgot your password?' })).toBeTruthy();
  expect(location.pathname).toBe('/reset-password');
  expect(screen.queryByLabelText('Current password', { exact: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'Send verification code' }).disabled).toBe(false);
  expect(screen.queryByRole('button', { name: 'Update password' })).toBeNull();
  expect(api.resetPasswordForEmail).not.toHaveBeenCalled();
});

test('incorrect recovery codes cannot update any account password', async () => {
  api.verifyOtp.mockResolvedValueOnce({ data: null, error: { code: 'otp_expired' } });
  open('/reset-password');
  await paste('you@example.com', 'cadet@example.test');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Send verification code' }));
  await paste('Enter your code', '123456');
  await user.click(screen.getByRole('button', { name: 'Verify code' }));
  expect(screen.getByRole('alert').textContent).toContain('invalid or has expired');
  expect(api.updateUser).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('New password', { exact: true })).toBeNull();
});

test('signed-out users verify an emailed recovery code then update their own password', async () => {
  api.verifyOtp.mockImplementationOnce(async () => {
    auth.user = { id: 'u1', email: 'cadet@example.test' };
    return { data: { user: auth.user, session: { access_token: 'test-session' } }, error: null };
  });
  open('/reset-password');
  await paste('you@example.com', 'cadet@example.test');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Send verification code' }));
  expect(api.resetPasswordForEmail).toHaveBeenCalledWith('cadet@example.test', { redirectTo: `${window.location.origin}/reset-password` });
  expect(screen.queryByLabelText('New password', { exact: true })).toBeNull();
  await paste('Enter your code', '123456');
  await user.click(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('heading', { name: 'Set a new password.' })).toBeTruthy();
  expect(api.verifyOtp).toHaveBeenCalledWith({ email: 'cadet@example.test', token: '123456', type: 'recovery' });
  await setPasswords();
  await user.click(screen.getByRole('button', { name: 'Update password' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back, cadet.' })).toBeTruthy();
  expect(location.pathname).toBe('/login');
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(api.updateUser).toHaveBeenCalledWith({ password: 'new-test-password' });
  expect(api.resetPasswordForEmail).toHaveBeenCalledTimes(1);
});

test('email delivery failures keep the user on the email step', async () => {
  api.resetPasswordForEmail.mockResolvedValueOnce({ error: { status: 429 } });
  open('/reset-password');
  await paste('you@example.com', 'cadet@example.test');
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  expect(screen.getByRole('alert').textContent).toContain('email sending limit');
  expect(screen.queryByLabelText('Verification code')).toBeNull();
  expect(api.verifyOtp).not.toHaveBeenCalled();
});

test('resending is throttled and changing email clears the old code', async () => {
  open('/reset-password');
  await paste('you@example.com', 'cadet@example.test');
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  const resend = screen.getByRole('button', { name: /Resend code in/ });
  expect(resend.disabled).toBe(true);
  await userEvent.click(resend);
  expect(api.resetPasswordForEmail).toHaveBeenCalledTimes(1);
  await paste('Enter your code', '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
  expect(screen.queryByLabelText('Verification code')).toBeNull();
  expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
  expect(api.verifyOtp).not.toHaveBeenCalled();
});

test('signed-in users change their password directly without an email or browser password storage', async () => {
  auth.user = { id: 'u1' };
  open('/reset-password');
  await setPasswords();
  await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back, cadet.' })).toBeTruthy();
  expect(location.pathname).toBe('/login');
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status').textContent).toContain('Log in with your new password');
  expect(screen.getByPlaceholderText('Enter your password').value).toBe('');
  expect(api.updateUser).toHaveBeenCalledWith({ password: 'new-test-password' });
  expect(api.resetPasswordForEmail).not.toHaveBeenCalled();
  expect(auth.completePasswordRecovery).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('New password', { exact: true })).toBeNull();
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('new-test-password');
});

test('mismatched passwords do not contact the update API', async () => {
  auth.user = { id: 'u1' };
  open('/reset-password');
  await setPasswords('new-test-password', 'different-password');
  await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(screen.getByRole('alert').textContent).toContain('Passwords do not match');
  expect(api.updateUser).not.toHaveBeenCalled();
  expect(auth.signOut).not.toHaveBeenCalled();
});

test('failed sign out can be retried without changing the password again', async () => {
  auth.user = { id: 'u1' };
  auth.signOut.mockRejectedValueOnce(new Error('Offline'));
  open('/reset-password');
  await setPasswords();
  await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(location.pathname).toBe('/reset-password');
  expect(api.updateUser).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Continue to login' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back, cadet.' })).toBeTruthy();
  expect(api.updateUser).toHaveBeenCalledTimes(1);
  expect(auth.signOut).toHaveBeenCalledTimes(2);
});

test('pending password updates prevent duplicate submissions', async () => {
  auth.user = { id: 'u1' };
  let complete;
  api.updateUser.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  open('/reset-password');
  await setPasswords();
  await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
  const button = screen.getByRole('button', { name: /Please wait/ });
  expect(button.disabled).toBe(true);
  await userEvent.click(button);
  expect(api.updateUser).toHaveBeenCalledTimes(1);
  await act(async () => { complete({ data: { user: { id: 'u1' } }, error: null }); });
});

test('existing verified recovery sessions still reach the password form', async () => {
  auth.user = { id: 'u1' }; auth.passwordRecovery = true;
  open('/');
  expect(await screen.findByRole('heading', { name: 'Set a new password.' })).toBeTruthy();
  expect(location.pathname).toBe('/reset-password');
  expect(auth.refreshUser).not.toHaveBeenCalled();
});

test('password visibility controls are independent for both fields', async () => {
  auth.user = { id: 'u1' };
  open('/reset-password');
  await userEvent.click(screen.getByRole('button', { name: 'Show new password' }));
  expect(screen.getByLabelText('New password', { exact: true }).type).toBe('text');
  expect(screen.getByLabelText('Confirm new password', { exact: true }).type).toBe('password');
  await userEvent.click(screen.getByRole('button', { name: 'Show confirm new password' }));
  expect(screen.getByLabelText('Confirm new password', { exact: true }).type).toBe('text');
});

test('expired sessions during submission show a login error rather than success', async () => {
  auth.user = { id: 'u1' };
  api.updateUser.mockResolvedValueOnce({ error: { status: 401 } });
  open('/reset-password');
  await setPasswords();
  await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(screen.getByRole('alert').textContent).toContain('Please log in again');
  expect(screen.queryByRole('heading', { name: 'Password updated.' })).toBeNull();
  expect(auth.completePasswordRecovery).not.toHaveBeenCalled();
});
