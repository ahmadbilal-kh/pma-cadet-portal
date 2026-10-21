import { requirePhoneProof } from './phoneVerification.js';

export function validateRegistration({ fullName, email, password, confirmPassword }) {
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 80) {
    throw new Error('Enter your full name (2 to 80 characters).');
  }
  const cleanEmail = normalizeEmail(email);
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('Your password must contain 8 to 128 characters.');
  }
  if (password !== confirmPassword) throw new Error('Passwords do not match. Please enter the same password twice.');
  return { fullName: fullName.trim(), email: cleanEmail, password };
}

export function normalizeEmail(email) {
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Enter a valid email address.');
  }
  return cleanEmail;
}

export async function registerAccount(client, { fullName, email, password, origin, phoneProof }) {
  const registration = validateRegistration({ fullName, email, password, confirmPassword: password });
  requirePhoneProof(phoneProof, phoneProof?.phone, registration.email);
  const { data, error } = await client.auth.signUp({
    email: registration.email, password: registration.password,
    options: { data: { full_name: registration.fullName, phone_number: phoneProof.phone, phone_verification_id: phoneProof.id, phone_verification_secret: phoneProof.secret }, emailRedirectTo: `${origin}/login` },
  });
  if (error) {
    if (error.code === 'over_email_send_rate_limit' || /email rate limit exceeded/i.test(error.message || '')) {
      throw new Error('The confirmation email sending limit has been reached. Please wait before trying again. If you registered earlier, check your inbox for a confirmation email or try logging in.');
    }
    throw error;
  }
  if (!data?.user) throw new Error('Registration could not be completed. Please try again.');
  // Supabase can conceal an existing email with an empty identities array.
  // Do not label that response as a newly created account or prefill its password.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('Registration could not be confirmed. Try logging in or check your confirmation email.');
  }
  return { confirmationRequired: !data.session };
}

export async function loginAccount(client, { email, password }) {
  const cleanEmail = normalizeEmail(email);
  if (typeof password !== 'string' || !password) throw new Error('Enter your password.');
  const { data, error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) {
    if (error.code === 'email_not_confirmed') throw new Error('Confirm your email using the registration email, then log in.');
    if (error.code === 'invalid_credentials' || /invalid login/i.test(error.message || '')) {
      throw new Error('Invalid email or password. Please try again.');
    }
    throw error;
  }
  if (!data?.session || !data?.user) throw new Error('Login could not be completed. Please try again.');
  return data;
}
