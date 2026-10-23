import test from 'node:test';
import assert from 'node:assert/strict';
import { internationalPhone, requirePhoneProof } from '../src/lib/phoneVerification.js';
import { handlePhoneVerification } from '../supabase/functions/phone-verification/handler.js';

const id = '11111111-1111-4111-8111-111111111111', secret = 'a'.repeat(64);
const phone = '+923001234567', email = 'cadet@example.test';
test('phone normalization and proof validation reject changed, expired, missing and preview proofs', () => {
  assert.equal(internationalPhone('PK','3001234567'), phone);
  assert.throws(() => internationalPhone('PK','123'));
  const proof = { id, secret, phone, email, expiresAt: Date.now()+60000, verified: true };
  assert.equal(requirePhoneProof(proof,phone,email),proof);
  for (const change of [{ verified: false }, { preview: true }, { expiresAt: 0 }, { expiresAt: undefined }, { phone: '+923009999999' }, { email: 'other@example.test' }]) assert.throws(() => requirePhoneProof({ ...proof, ...change },phone,email),/Verify your mobile/);
});
const settings = { accountSid: 'test-account', authToken: 'test-token', serviceSid: 'test-service' };
test('SMS service rejects missing configuration and non-registration requests without sending', async () => {
  const never = () => assert.fail('must not send');
  assert.equal((await handlePhoneVerification({}, {}, {}, never)).status,503);
  assert.equal((await handlePhoneVerification({ action: 'send', purpose: 'profile', country:'PK', phone, email }, {}, settings, never)).status,400);
});
function fixture(approved = true) {
  const calls = [], updates = [];
  const context = { userClaims: null, supabaseAdmin: {
    rpc: async (name, parameters) => { calls.push({ name, parameters }); return { data: { id, phone, email, expires_at: new Date(Date.now()+600000).toISOString(), twilio_sid: 'VE'+'a'.repeat(32), verified_at: null } }; },
    from: () => ({ update: values => { updates.push(values); return { eq: () => ({ eq: async () => ({ error: null }) }) }; } }),
  } };
  const requests = [];
  const request = async (url, options) => { requests.push({url,options}); return { ok: true, json: async () => ({ sid:'VE'+'a'.repeat(32), status: url.endsWith('VerificationCheck') ? approved ? 'approved' : 'pending' : 'pending' }) }; };
  return { context, request, requests, calls, updates };
}
test('SMS send reserves a rate-limited challenge and never returns the provider code or credentials', async () => {
  const f = fixture();
  const result = await handlePhoneVerification({ action:'send', purpose:'registration', country:'PK', phone, email }, f.context, settings, f.request);
  assert.equal(result.status,200);
  assert.equal(f.calls[0].name,'issue_phone_challenge');
  assert.equal(f.calls[0].parameters.p_user_id,null);
  assert.equal(f.calls[0].parameters.p_hash.length,64);
  assert.equal(result.body.secret.length,64);
  assert.equal(Object.hasOwn(result.body,'code'),false);
  assert.equal(JSON.stringify(result.body).includes(settings.authToken),false);
  assert.equal(f.requests[0].options.body.get('To'),phone);
});
test('SMS checks use the reserved verification SID and only approve provider-confirmed codes', async () => {
  const f = fixture();
  const result = await handlePhoneVerification({ action:'verify', purpose:'registration', id, secret, email, code:'123456' }, f.context, settings, f.request);
  assert.equal(result.status,200);
  assert.equal(result.body.verified,true);
  assert.equal(f.requests[0].options.body.get('VerificationSid'),'VE'+'a'.repeat(32));
  assert.ok(f.updates[0].verified_at);
  const rejected = fixture(false);
  assert.equal((await handlePhoneVerification({ action:'verify', purpose:'registration', id, secret, email, code:'999999' }, rejected.context, settings, rejected.request)).status,400);
  assert.equal(rejected.updates.length,0);
});
test('profile verification requests are no longer supported', async () => {
  const f = fixture();
  f.context.userClaims = { id:'account-1', email };
  const result = await handlePhoneVerification({ action:'send', purpose:'profile', country:'PK', phone, email }, f.context, settings, () => assert.fail('must not send'));
  assert.equal(result.status,400);
  assert.equal(f.calls.length,0);
});
test('rate-limited, invalid and expired challenges never reach the SMS provider', async () => {
  const context = { userClaims: null, supabaseAdmin: { rpc: async () => ({ error: { code:'P0001', message:'Wait 60 seconds.' } }) } };
  const never = () => assert.fail('must not send');
  assert.equal((await handlePhoneVerification({action:'send',purpose:'registration',country:'PK',phone,email},context,settings,never)).status,429);
  assert.equal((await handlePhoneVerification({action:'verify',purpose:'registration',id,secret,email,code:'123'},context,settings,never)).status,400);
  assert.equal((await handlePhoneVerification({action:'verify',purpose:'registration',id,secret,email,code:'123456'},context,settings,never)).status,400);
});
