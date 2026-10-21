import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPasswordReset, updatePassword, verifyRecoveryCode } from '../src/lib/passwordRecovery.js';

test('reset email normalizes the address and sends users to the reset route', async () => {
  let request;
  const client = { auth: { resetPasswordForEmail: async (...args) => { request = args; return { error: null }; } } };
  await requestPasswordReset(client, '  CADET@Example.Test  ', 'https://cadet.example');
  assert.deepEqual(request, ['cadet@example.test', { redirectTo: 'https://cadet.example/reset-password' }]);
});

test('invalid reset email does not contact the service', async () => {
  let contacted = false;
  const client = { auth: { resetPasswordForEmail: async () => { contacted = true; } } };
  await assert.rejects(requestPasswordReset(client, 'invalid', 'https://cadet.example'), /valid email/);
  assert.equal(contacted, false);
});

test('reset email rate limits give a useful error', async () => {
  const client = { auth: { resetPasswordForEmail: async () => ({ error: { code: 'over_email_send_rate_limit' } }) } };
  await assert.rejects(requestPasswordReset(client, 'cadet@example.test', 'https://cadet.example'), /email sending limit/);
});

test('password update rejects short or mismatched passwords before contacting the service', async () => {
  let contacted = false;
  const client = { auth: { updateUser: async () => { contacted = true; } } };
  await assert.rejects(updatePassword(client, 'short', 'short'), /8 to 128/);
  await assert.rejects(updatePassword(client, 'example-test-only', 'different'), /Passwords do not match/);
  assert.equal(contacted, false);
});

test('valid new passwords are sent to the authenticated password-update API', async () => {
  let request;
  const client = { auth: { updateUser: async data => { request = data; return { data: { user: { id: 'u1' } }, error: null }; } } };
  await updatePassword(client, 'example-test-only', 'example-test-only');
  assert.deepEqual(request, { password: 'example-test-only' });
});

test('missing and expired reset sessions cannot report a successful update', async () => {
  const expired = { auth: { updateUser: async () => ({ error: { status: 401 } }) } };
  await assert.rejects(updatePassword(expired, 'example-test-only', 'example-test-only'), /session is missing or has expired/);
  const missing = { auth: { updateUser: async () => ({ data: {}, error: null }) } };
  await assert.rejects(updatePassword(missing, 'example-test-only', 'example-test-only'), /could not be updated/);
});

test('recovery codes verify the normalized email with the recovery token type', async () => {
  let request;
  const client = { auth: { verifyOtp: async input => {
    request = input;
    return { data: { user: { id: 'u1', email: 'cadet@example.test' }, session: { access_token: 'test' } }, error: null };
  } } };
  await verifyRecoveryCode(client, ' CADET@example.test ', ' 123456 ');
  assert.deepEqual(request, { email: 'cadet@example.test', token: '123456', type: 'recovery' });
});

test('malformed recovery codes do not reach the service', async () => {
  let contacted = false;
  const client = { auth: { verifyOtp: async () => { contacted = true; } } };
  await assert.rejects(verifyRecoveryCode(client, 'cadet@example.test', 'abc123'), /verification code/);
  assert.equal(contacted, false);
});

test('invalid codes, missing sessions, and a different account cannot verify recovery', async () => {
  for (const response of [
    { error: { code: 'otp_expired' } },
    { data: { user: { email: 'cadet@example.test' } } },
    { data: { user: { email: 'other@example.test' }, session: { access_token: 'test' } } },
  ]) {
    const client = { auth: { verifyOtp: async () => response } };
    await assert.rejects(verifyRecoveryCode(client, 'cadet@example.test', '123456'), /invalid|Unable to verify/);
  }
});
