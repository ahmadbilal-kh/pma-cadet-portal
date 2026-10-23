import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBooking, interviewState, INTERVIEW_WINDOW, normalizeBooking, readBooking, saveBooking, retryBookingSave, loadBooking, cacheBooking, updateInterviewStatus } from '../src/lib/issb.js';
import { sendInterviewReminders } from '../supabase/functions/issb-reminders/worker.js';

const now = Date.now();
const fields = { fullName: ' Ahmad Bilal ', email: 'CADET@example.test', date: '2099-01-01', time: '10:30' };

test('booking normalizes names, email and a future appointment without requiring a phone', () => {
  const booking = validateBooking(fields, now);
  assert.equal(booking.fullName, 'Ahmad Bilal');
  assert.equal(booking.email, 'cadet@example.test');
  assert.equal(Object.hasOwn(booking,'phone'),false);
  assert.equal(booking.startsAt, new Date('2099-01-01T10:30').getTime());
  for (const invalid of [{ fullName: '' }, { email: 'invalid' }, { date: '2000-01-01' }, { time: '' }]) assert.throws(() => validateBooking({ ...fields, ...invalid }, now));
});
test('practice can start before or after its scheduled time and started sessions stay open', () => {
  const booking = { startsAt: now, status: 'scheduled' };
  assert.equal(interviewState(booking, now - 1), 'scheduled');
  assert.equal(interviewState(booking, now), 'ready');
  assert.equal(interviewState({ ...booking, status: 'started' }, now + 1), 'started');
  assert.equal(interviewState(booking, now + INTERVIEW_WINDOW), 'ready');
  assert.equal(interviewState({ ...booking, status: 'started' }, now - 1), 'started');
  assert.equal(interviewState({ ...booking, status: 'started' }, now + INTERVIEW_WINDOW), 'started');
  assert.equal(interviewState({ ...booking, status: 'completed' }, now + INTERVIEW_WINDOW), 'completed');
});
test('booking requires its account email and invalid transitions never contact the server', async () => {
  const user = { id: 'u1', email: 'cadet@example.test' };
  await assert.rejects(saveBooking(null, user, { ...fields, email: 'someone@example.test' }), /verified email/);
  let calls = 0;
  await assert.rejects(updateInterviewStatus({ rpc: () => { calls++; } }, user.id, { id: 'b1', startsAt: now + 60000, status: 'completed', synced: true }, 'started'), /available interview/);
  await assert.rejects(updateInterviewStatus({ rpc: () => { calls++; } }, user.id, { id: 'b1', startsAt: now + 60000, status: 'scheduled', synced: true }, 'completed'), /Start the interview/);
  assert.equal(calls, 0);
});
test('email queue does not claim or send reminders without server settings', async () => {
  const result = await sendInterviewReminders({ rpc: () => assert.fail('must not claim') }, {}, () => assert.fail('must not send'));
  assert.equal(result.status, 503);
});
test('account booking uses the restricted RPC and caches a normalized account-owned response', async context => {
  const descriptors = ['window', 'localStorage'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const entries = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => {} } });
  context.after(() => { for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } });
  const details = validateBooking(fields, now);
  const user = { id: 'u1', email: 'cadet@example.test' };
  let calls = 0;
  const client = { from: () => assert.fail('booking must not query profile phone records'), rpc: async (name, parameters) => {
    calls++;
    assert.equal(name, 'schedule_issb_interview');
    assert.equal(Object.hasOwn(parameters,'p_phone'),false);
    assert.equal(Object.hasOwn(parameters,'p_country'),false);
    assert.equal(parameters.p_starts_at, new Date(details.startsAt).toISOString());
    assert.equal(Object.hasOwn(parameters, 'user_id'), false);
    return { data: { id: 'account-booking', full_name: details.fullName, email: details.email, timezone: details.timezone, starts_at: parameters.p_starts_at, status: 'scheduled' } };
  } };
  const saved = await saveBooking(client, user, fields, now);
  assert.equal(saved.synced, true);
  assert.equal(calls, 1);
  assert.equal(readBooking('u1').id, 'account-booking');
  assert.equal(readBooking('u2'), null);
  await assert.rejects(saveBooking({ ...client, rpc: async () => ({ error: { code: 'P0001', message: 'Confirm your account email before booking.' } }) }, user, fields), /Confirm your account email/);
  assert.equal(readBooking('u1').id, 'account-booking');
});
test('damaged booking data cannot crash the schedule page', () => {
  assert.equal(normalizeBooking({ id: 'b1', status: 'scheduled', startsAt: now }), null);
  assert.equal(normalizeBooking({ id: 'b1', status: 'scheduled', startsAt: now, firstName: 'Ahmad', lastName: 'Bilal', email: 'cadet@example.test', phone: '+923001234567', country: 'PK', timezone: 'Not/A-Timezone' }), null);
  assert.throws(() => validateBooking({ ...fields, date: '2099-02-31' }, now), /future interview/);
});
test('failed account saves preserve local data; retry keeps its instant and reconciles lost responses', async context => {
  const descriptors = ['window', 'localStorage'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const entries = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => {} } });
  context.after(() => { for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } });
  const user = { id: 'u1', email: 'cadet@example.test' };
  const pending = { ...validateBooking(fields), id: 'local', timezone: 'Pacific/Auckland', synced: false, status: 'scheduled' };
  cacheBooking(user.id, pending);
  await assert.rejects(saveBooking({ rpc: async () => ({error: {code: 'PGRST205'}}) }, user, fields), /issb-bookings.sql/);
  await assert.rejects(saveBooking({ rpc: async () => { throw new TypeError('Failed to fetch'); } }, user, fields), /connection/);
  await assert.rejects(saveBooking(null, user, fields), /Unable to save/);
  assert.equal(readBooking(user.id).id, 'local');
  let calls = 0;
  const client = { rpc: async (_, args) => {
    calls++;
    assert.equal(args.p_timezone, 'Pacific/Auckland');
    assert.equal(args.p_starts_at, new Date(pending.startsAt).toISOString());
    return { data: { ...pending, id: 'remote', synced: true } };
  } };
  assert.equal((await retryBookingSave(client, user, pending)).id, 'remote');
  assert.equal(calls, 1);
  cacheBooking(user.id, pending);
  const remote = {...pending, id: 'remote', synced: true};
  client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({data: remote}) }) }) });
  assert.equal((await loadBooking(client, user.id)).synced, true);
  cacheBooking(user.id, pending);
  assert.equal((await retryBookingSave(client, user, pending, pending.startsAt + 1)).id, 'remote');
  assert.equal(calls, 1, 'reconciliation must not recreate the reminder');
  cacheBooking(user.id, pending);
  client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({data: {...remote, startsAt: remote.startsAt + 60000}}) }) }) });
  assert.equal((await loadBooking(client, user.id)).id, 'local');
  await assert.rejects(retryBookingSave(client, user, pending, pending.startsAt), /Reschedule/);
});
function queue({ providerOk = true, current = true, updateError = false } = {}) {
  const updates = [], requests = [];
  const booking = { id: 'booking-1', email_claim: 'claim-1', first_name: 'Ahmad', email: 'cadet@example.test', starts_at: '2099-01-01T10:30:00Z', timezone: 'UTC' };
  const db = { rpc: async name => { assert.equal(name, 'claim_issb_reminders'); return { data: [booking] }; }, from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current ? { ...booking, status: 'scheduled' } : null }) }) }),
    update: values => { updates.push(values); return { eq: () => ({ eq: async () => ({ error: updateError ? { message: 'Offline' } : null }) }) }; },
  }) };
  return { db, updates, requests, request: async (url, options) => { requests.push({ url, ...options }); return { ok: providerOk }; } };
}
const settings = { apiKey: 'test-key', from: 'CadetPrep <sender@example.test>', appUrl: 'https://cadet.example.test' };
test('email worker sends the claimed appointment to its account email with a stable idempotency key', async () => {
  const q = queue();
  const result = await sendInterviewReminders(q.db, settings, q.request);
  assert.equal(result.status, 200);
  assert.equal(result.body.sent, 1);
  assert.equal(q.requests[0].headers['Idempotency-Key'], 'issb-reminder/booking-1');
  const email = JSON.parse(q.requests[0].body);
  assert.deepEqual(email.to, ['cadet@example.test']);
  assert.match(email.text, /https:\/\/cadet.example.test\/issb/);
  assert.equal(q.updates[0].email_state, 'sent');
});
test('email worker leaves failed delivery retryable and skips replaced bookings', async () => {
  const failed = queue({ providerOk: false });
  assert.equal((await sendInterviewReminders(failed.db, settings, failed.request)).body.failed, 1);
  assert.deepEqual(failed.updates, [{ email_state: 'pending' }]);
  const replaced = queue({ current: false });
  assert.equal((await sendInterviewReminders(replaced.db, settings, replaced.request)).body.sent, 0);
  assert.equal(replaced.requests.length, 0);
});
