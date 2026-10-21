import { countries } from './countries.js';

export function internationalPhone(country, phone) {
  const entry = countries.find(([code]) => code === country);
  const number = String(phone || '');
  if (!entry || !/^\d{10}$/.test(number) || entry[2].length + number.length > 15) throw new Error('Enter exactly 10 digits for your mobile number, without the country code.');
  return `+${entry[2]}${number}`;
}
export function requirePhoneProof(proof, phone, email, now = Date.now()) {
  if (!/^[0-9a-f-]{36}$/i.test(proof?.id || '') || !/^[0-9a-f]{64}$/.test(proof?.secret || '') || !/^\+[1-9]\d{6,14}$/.test(phone || '') || proof.phone !== phone || proof.email !== email.trim().toLowerCase() || !proof.verified || proof.preview || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= now) throw new Error('Verify your mobile number before continuing.');
  return proof;
}
export async function phoneRequest(client, body) {
  if (!client?.functions?.invoke) throw new Error('SMS verification needs setup. Follow supabase/PHONE_VERIFICATION_SETUP.md.');
  // A public publishable key is not a JWT. Omit the SDK's default Bearer key
  // on signed-out registration requests; this endpoint is used only for registration.
  const { data, error } = await client.functions.invoke('phone-verification', { body,
    ...(body.purpose === 'registration' ? { headers: { Authorization: '' } } : {}) });
  if (error) {
    let message;
    try { message = (await error.context?.json())?.error; } catch { /* Use a safe setup/network explanation. */ }
    throw new Error(message || 'Unable to send or verify the SMS code. Check your connection and SMS service setup.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
