const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status, body) => ({ status, body });
async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
}
export async function handlePhoneVerification(body, context, settings, request = fetch) {
  if (!settings.accountSid || !settings.authToken || !settings.serviceSid) return reply(503, { error: 'SMS is not configured yet. Follow supabase/PHONE_VERIFICATION_SETUP.md to enable verification codes.' });
  if (body?.purpose !== 'registration' || !['send','verify'].includes(body?.action)) return reply(400, { error: 'Invalid verification request.' });
  const owner = null;
  const emailValue = body.email;
  const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Enter a valid email address.' });
  const database = context.supabaseAdmin;
  const authorization = `Basic ${btoa(`${settings.accountSid}:${settings.authToken}`)}`;
  const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(settings.serviceSid)}`;
  try {
    if (body.action === 'send') {
      const dialing = {PK:'92',AF:'93',AU:'61',BD:'880',CA:'1',CN:'86',DE:'49',IN:'91',MY:'60',NZ:'64',OM:'968',QA:'974',SA:'966',TR:'90',AE:'971',GB:'44',US:'1'}[body.country];
      if (!dialing || !new RegExp('^\\+' + dialing + '[0-9]{10}$').test(body.phone || '')) return reply(400, { error: 'Enter a valid international mobile number.' });
      const id = crypto.randomUUID();
      const secret = [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2,'0')).join('');
      const secretHash = await hash(secret);
      const { data: challenge, error } = await database.rpc('issue_phone_challenge', { p_id: id, p_hash: secretHash, p_phone: body.phone, p_email: email, p_purpose: body.purpose, p_user_id: owner, p_country: body.country });
      if (error) return reply(error.code === 'P0001' ? 429 : 503, { error: error.code === 'P0001' ? error.message : 'SMS storage needs setup. Run supabase/phone-verification.sql.' });
      const response = await request(`${endpoint}/Verifications`, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: body.phone, Channel: 'sms' }) });
      const result = await response.json();
      if (!response.ok || result.status !== 'pending' || !/^VE[0-9a-f]{32}$/i.test(result.sid || '')) return reply(502, { error: 'SMS could not be sent. Check the provider account, destination permissions, and sending limits.' });
      const { error: saveError } = await database.from('phone_verifications').update({ twilio_sid: result.sid }).eq('id', id).eq('secret_hash', secretHash);
      if (saveError) return reply(503, { error: 'SMS was requested but verification storage failed. Please try again after one minute.' });
      return reply(200, { id, secret, expiresAt: Date.parse(challenge.expires_at) });
    }
    if (!uuid.test(body.id || '') || !/^[0-9a-f]{64}$/.test(body.secret || '') || !/^\d{6}$/.test(body.code || '')) return reply(400, { error: 'Enter a valid 6-digit SMS code.' });
    const secretHash = await hash(body.secret);
    const { data: challenge, error } = await database.rpc('take_phone_verification_attempt', { p_id: body.id, p_hash: secretHash, p_email: email, p_purpose: body.purpose, p_user_id: owner });
    if (error || !challenge) return reply(400, { error: 'Code expired or too many attempts. Request a new code.' });
    if (!challenge.verified_at) {
      const response = await request(`${endpoint}/VerificationCheck`, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ VerificationSid: challenge.twilio_sid, Code: body.code }) });
      const result = await response.json();
      if (!response.ok || result.status !== 'approved') return reply(400, { error: 'Invalid or expired SMS code. Please try again or request another code.' });
      const { error: updateError } = await database.from('phone_verifications').update({ verified_at: new Date().toISOString() }).eq('id', body.id).eq('secret_hash', secretHash);
      if (updateError) return reply(503, { error: 'Verification could not be saved. Please try again.' });
    }
    return reply(200, { verified: true, phone: challenge.phone });
  } catch { return reply(503, { error: 'SMS verification is temporarily unavailable. Please try again.' }); }
}
