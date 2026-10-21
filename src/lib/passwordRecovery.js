import { normalizeEmail } from './registration.js';

export async function requestPasswordReset(client, email, origin) {
  const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) {
    if (error.code === 'over_email_send_rate_limit' || error.status === 429 || /email rate limit/i.test(error.message || '')) {
      throw new Error('The email sending limit has been reached. Please wait before requesting another reset link.');
    }
    throw error;
  }
}

export async function verifyRecoveryCode(client, email, code) {
  const normalizedEmail = normalizeEmail(email);
  const token = code.trim();
  if (!/^\d{6,8}$/.test(token)) throw new Error('Enter the verification code from your email.');
  const { data, error } = await client.auth.verifyOtp({ email: normalizedEmail, token, type: 'recovery' });
  if (error) {
    if (error.status === 429) throw new Error('Too many attempts. Please wait before trying again.');
    throw new Error('The code is invalid or has expired. Check your email or request a new code.');
  }
  if (!data?.user || !data?.session || data.user.email?.toLowerCase() !== normalizedEmail) {
    throw new Error('Unable to verify your account. Please request a new code.');
  }
}

export async function updatePassword(client, password, confirmation) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('Your password must contain 8 to 128 characters.');
  }
  if (password !== confirmation) throw new Error('Passwords do not match. Please enter the same password twice.');
  const { data, error } = await client.auth.updateUser({ password });
  if (error) {
    if (error.status === 401 || error.code === 'session_not_found' || error.name === 'AuthSessionMissingError') {
      throw new Error('Your session is missing or has expired. Please log in again to update your password.');
    }
    throw error;
  }
  if (!data?.user) throw new Error('Your password could not be updated. Please log in again and try once more.');
}
