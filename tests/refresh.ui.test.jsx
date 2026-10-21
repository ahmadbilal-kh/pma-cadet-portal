import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

const service = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() }));
const photos = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn(), prepare: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ configured: true, supabase: { auth: service, storage: { from: () => photos } } }));
vi.mock('../src/lib/avatar', () => ({ AVATAR_BUCKET: 'cadet-avatars', prepareAvatar: photos.prepare }));
let latest;
let notify;
function Account() {
  latest = useAuth();
  return <span>{latest.loading ? 'Loading' : latest.user?.user_metadata?.full_name || 'Signed out'}</span>;
}
const session = { access_token: 'test-only', user: { id: 'u1', user_metadata: { full_name: 'Old name' } } };
beforeEach(() => {
  photos.prepare.mockReset().mockResolvedValue(new Blob(['processed'], { type: 'image/webp' }));
  photos.upload.mockReset().mockResolvedValue({ error: null });
  photos.remove.mockReset().mockResolvedValue({ error: null });
  photos.createSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: 'https://example.test/signed-photo' }, error: null });
  service.getSession.mockReset().mockResolvedValue({ data: { session }, error: null });
  service.getUser.mockReset();
  service.updateUser.mockReset();
  service.onAuthStateChange.mockImplementation(callback => {
    notify = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

test('a saved photo is uploaded to the current account folder and updates its signed avatar URL', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  service.updateUser.mockImplementation(async ({ data }) => ({ data: { user: { ...session.user, user_metadata: { ...session.user.user_metadata, ...data } } }, error: null }));
  const file = new File(['photo'], 'test.png', { type: 'image/png' });
  await act(async () => { await latest.updateAvatar(file); });
  const path = photos.upload.mock.calls[0][0];
  expect(path).toMatch(/^u1\/.*\.webp$/);
  expect(service.updateUser).toHaveBeenCalledWith({ data: { avatar_path: path } });
  expect(latest.avatarUrl).toBe('https://example.test/signed-photo');
});

test('a failed avatar metadata save removes the new upload and preserves the current account', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  service.updateUser.mockResolvedValue({ error: new Error('Unable to save') });
  await expect(latest.updateAvatar(new File(['photo'], 'test.png', { type: 'image/png' }))).rejects.toThrow('Unable to save');
  expect(photos.remove).toHaveBeenCalledWith([photos.upload.mock.calls[0][0]]);
  expect(latest.avatarUrl).toBe('');
});

test('an upload failure cannot replace the saved avatar metadata', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  photos.upload.mockResolvedValue({ error: new Error('Bucket not found') });
  await expect(latest.updateAvatar(new File(['photo'], 'test.png', { type: 'image/png' }))).rejects.toThrow('avatar-storage.sql');
  expect(service.updateUser).not.toHaveBeenCalled();
});

test('removing an avatar clears account metadata and deletes the old owned file', async () => {
  const account = { ...session.user, user_metadata: { full_name: 'Old name', avatar_path: 'u1/old.webp' } };
  service.getSession.mockResolvedValue({ data: { session: { ...session, user: account } }, error: null });
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  service.updateUser.mockResolvedValue({ data: { user: { ...account, user_metadata: { full_name: 'Old name', avatar_path: null } } }, error: null });
  await act(async () => { await latest.updateAvatar(null); });
  expect(service.updateUser).toHaveBeenCalledWith({ data: { avatar_path: null } });
  expect(photos.remove).toHaveBeenCalledWith(['u1/old.webp']);
  expect(latest.avatarUrl).toBe('');
});
afterEach(cleanup);

test('recovery events enable password recovery routing and completion clears it', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  await act(async () => { notify('PASSWORD_RECOVERY', session); });
  expect(latest.passwordRecovery).toBe(true);
  await act(async () => { latest.completePasswordRecovery(); });
  expect(latest.passwordRecovery).toBe(false);
  await act(async () => { notify('PASSWORD_RECOVERY', session); notify('SIGNED_OUT', null); });
  expect(latest.passwordRecovery).toBe(false);
});

test('refresh replaces cached account details with the saved server profile', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  service.getUser.mockResolvedValue({ data: { user: { id: 'u1', user_metadata: { full_name: 'Updated name' } } }, error: null });
  await act(() => latest.refreshUser());
  expect(screen.getByText('Updated name')).toBeTruthy();
  expect(latest.session.access_token).toBe('test-only');
});

test('refresh errors retain the current account and are reported to the caller', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  service.getUser.mockResolvedValue({ data: {}, error: new Error('Offline') });
  await expect(latest.refreshUser()).rejects.toThrow('Offline');
  expect(screen.getByText('Old name')).toBeTruthy();
});

test('a late refresh response cannot restore an account after sign out', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  let resolveUser;
  service.getUser.mockImplementation(() => new Promise(resolve => { resolveUser = resolve; }));
  const pending = latest.refreshUser();
  await vi.waitFor(() => expect(service.getUser).toHaveBeenCalled());
  await act(async () => { notify('SIGNED_OUT', null); });
  await act(async () => { resolveUser({ data: { user: session.user }, error: null }); await pending; });
  expect(screen.getByText('Signed out')).toBeTruthy();
  expect(latest.user).toBeNull();
});

test('saving a profile updates Supabase metadata and the current account name', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  const updated = { ...session.user, user_metadata: { full_name: 'New name' } };
  service.updateUser.mockResolvedValue({ data: { user: updated }, error: null });
  await act(async () => { await latest.updateProfile('  New name  '); });
  expect(service.updateUser).toHaveBeenCalledWith({ data: { full_name: 'New name' } });
  expect(screen.getByText('New name')).toBeTruthy();
  expect(latest.session.access_token).toBe('test-only');
});

test('invalid profile names are rejected without updating Supabase', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  for (const name of [' ', 'A', 'A'.repeat(81)]) await expect(latest.updateProfile(name)).rejects.toThrow('2 to 80');
  expect(service.updateUser).not.toHaveBeenCalled();
});

test('profile service failures retain the saved account name', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  service.updateUser.mockResolvedValue({ data: {}, error: new Error('Offline') });
  await expect(latest.updateProfile('New name')).rejects.toThrow('Offline');
  expect(screen.getByText('Old name')).toBeTruthy();
});

test('a late profile response cannot restore an account after sign out', async () => {
  render(<AuthProvider><Account /></AuthProvider>);
  await screen.findByText('Old name');
  let resolveUpdate;
  service.updateUser.mockImplementation(() => new Promise(resolve => { resolveUpdate = resolve; }));
  const pending = latest.updateProfile('New name');
  await act(async () => { notify('SIGNED_OUT', null); });
  await act(async () => {
    resolveUpdate({ data: { user: { ...session.user, user_metadata: { full_name: 'New name' } } }, error: null });
    await pending;
  });
  expect(screen.getByText('Signed out')).toBeTruthy();
  await expect(latest.updateProfile('New name')).rejects.toThrow('Please log in again');
});
