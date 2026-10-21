import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../src/AppRoutes';

const auth = vi.hoisted(() => ({ user: null, loading: false, configured: true, updateProfile: vi.fn(), updateAvatar: vi.fn(), avatarUrl: '', refreshUser: vi.fn(), signOut: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: null }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }));
function open(path = '/profile') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppRoutes /></MemoryRouter>);
}
async function enterName(value) {
  const user = userEvent.setup();
  const field = screen.getByLabelText('Full name');
  await user.clear(field); await user.click(field); await user.paste(value);
}
beforeEach(() => {
  auth.signOut.mockReset().mockImplementation(async () => { auth.user = null; });
  auth.avatarUrl = '';
  auth.updateAvatar.mockReset().mockImplementation(async file => {
    auth.user = { ...auth.user, user_metadata: { ...auth.user.user_metadata, avatar_path: file ? 'u1/photo.webp' : null } };
    auth.avatarUrl = file ? 'https://example.test/photo.webp' : '';
  });
  auth.user = { id: 'u1', email: 'cadet@example.test', created_at: '2026-01-10T12:00:00Z', email_confirmed_at: '2026-01-10T12:00:00Z', user_metadata: { full_name: 'Ahmad Bilal' } };
  auth.refreshUser.mockReset().mockResolvedValue(undefined);
  auth.updateProfile.mockReset().mockImplementation(async name => {
    auth.user = { ...auth.user, user_metadata: { ...auth.user.user_metadata, full_name: name } };
    return auth.user;
  });
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

test('the profile header has a working sign-out button', async () => {
  open();
  const header = screen.getByRole('banner');
  expect(within(header).queryByRole('link', { name: 'Open cadet profile' })).toBeNull();
  const button = within(header).getByRole('button', { name: 'Sign out' });
  expect(button.className).toBe('logout-btn');
  await act(async () => { await userEvent.click(button); });
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole('heading', { name: /Train your mind/ })).toBeTruthy();
});

test('a failed profile sign out shows an error and allows retry', async () => {
  auth.signOut.mockRejectedValueOnce(new Error('Unable to sign out'));
  open();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Cadet Profile' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign out' }).disabled).toBe(false);
});

test('uploading a photo displays it in the profile and dashboard header', async () => {
  open();
  const file = new File(['photo'], 'photo.png', { type: 'image/png' });
  await userEvent.upload(screen.getByLabelText('Choose profile photo'), file);
  expect(auth.updateAvatar).toHaveBeenCalledWith(file);
  expect(await screen.findByText('Profile photo saved.')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Cadet account details' })).getByRole('img').getAttribute('src')).toBe(auth.avatarUrl);
  await userEvent.click(screen.getByRole('link', { name: 'Back to home' }));
  expect(within(screen.getByRole('link', { name: 'Open cadet profile' })).getByRole('img')).toBeTruthy();
});

test('removing a photo restores the initials avatar', async () => {
  auth.user.user_metadata.avatar_path = 'u1/photo.webp'; auth.avatarUrl = 'https://example.test/photo.webp';
  open();
  await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
  expect(auth.updateAvatar).toHaveBeenCalledWith(null);
  expect(await screen.findByText('Profile photo removed.')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(document.querySelector('.profile-monogram').textContent).toBe('AB');
});

test('unsupported photos do not reach the upload service', () => {
  open();
  fireEvent.change(screen.getByLabelText('Choose profile photo'), { target: { files: [new File(['text'], 'test.svg', { type: 'image/svg+xml' })] } });
  expect(screen.getByRole('alert').textContent).toContain('JPG, PNG, or WebP');
  expect(auth.updateAvatar).not.toHaveBeenCalled();
});

test('a failed photo upload retains the current avatar and permits another attempt', async () => {
  auth.user.user_metadata.avatar_path = 'u1/photo.webp'; auth.avatarUrl = 'https://example.test/photo.webp';
  auth.updateAvatar.mockRejectedValueOnce(new Error('Upload failed. Try again.'));
  open();
  await userEvent.upload(screen.getByLabelText('Choose profile photo'), new File(['photo'], 'photo.png', { type: 'image/png' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Cadet account details' })).getByRole('img').getAttribute('src')).toBe('https://example.test/photo.webp');
  expect(screen.getByRole('button', { name: 'Change photo' }).disabled).toBe(false);
});

test('a broken saved photo falls back to initials', () => {
  auth.avatarUrl = 'https://example.test/missing.webp';
  open();
  const card = within(screen.getByRole('region', { name: 'Cadet account details' }));
  fireEvent.error(card.getByRole('img'));
  expect(card.queryByRole('img')).toBeNull();
  expect(document.querySelector('.profile-monogram').textContent).toBe('AB');
});

test('profile is reachable from the dashboard sidebar and avatar', async () => {
  open('/dashboard');
  expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Change password' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Open cadet profile' }).getAttribute('href')).toBe('/profile');
  const nav = screen.getByRole('navigation', { name: 'Workspace navigation' });
  await userEvent.click(within(nav).getByRole('link', { name: 'Cadet Profile' }));
  expect(await screen.findByRole('heading', { name: 'Cadet Profile' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Cadet Profile', exact: true }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByLabelText('Full name').value).toBe('Ahmad Bilal');
  expect(screen.getByLabelText('Email address').readOnly).toBe(true);
  expect(screen.getByText('Verified', { exact: true })).toBeTruthy();
  expect(screen.getByText('10 January 2026')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Change password' }).getAttribute('href')).toBe('/reset-password');
});

test('saving a name updates the profile and the dashboard greeting', async () => {
  open();
  expect(screen.getByRole('button', { name: 'Save changes' }).disabled).toBe(true);
  await enterName('  Ali Khan  ');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(auth.updateProfile).toHaveBeenCalledWith('Ali Khan');
  expect(screen.getByRole('heading', { name: 'Ali Khan' })).toBeTruthy();
  await userEvent.click(screen.getByRole('link', { name: 'Back to home' }));
  expect(await screen.findByRole('heading', { name: /Welcome, Ali/ })).toBeTruthy();
});

test('signed-out visitors cannot open cadet profiles', async () => {
  auth.user = null;
  open();
  expect(await screen.findByRole('heading', { name: 'Welcome back, cadet.' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  expect(auth.updateProfile).not.toHaveBeenCalled();
});

test('a failed save preserves the draft and permits a retry', async () => {
  auth.updateProfile.mockRejectedValueOnce(new Error('Unable to save. Please retry.'));
  open();
  await enterName('Ali Khan');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByLabelText('Full name').value).toBe('Ali Khan');
  expect(screen.getByRole('heading', { name: 'Ahmad Bilal' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(auth.updateProfile).toHaveBeenCalledTimes(2);
});

test('a pending save prevents duplicate submissions', async () => {
  let finish;
  auth.updateProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  open();
  await enterName('Ali Khan');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const button = screen.getByRole('button', { name: 'Saving…' });
  expect(button.disabled).toBe(true);
  await userEvent.click(button);
  expect(auth.updateProfile).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ ...auth.user, user_metadata: { full_name: 'Ali Khan' } }); });
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
});


test('Cadet Profile has no mobile field or SMS verification section', () => {
  open();
  expect(screen.queryByLabelText('Mobile number')).toBeNull();
  expect(screen.queryByText('Your mobile number')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Send SMS code' })).toBeNull();
});
