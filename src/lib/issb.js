export { countries } from './countries.js';
import { createUUID } from './uuid.js';

export const INTERVIEW_WINDOW = 60 * 60 * 1000;
export const REMINDER_LEAD = 15 * 60 * 1000;

const key = id => `cadetprep:${id}:issb-booking`;
export function interviewState(booking, now = Date.now()) {
  if (!booking) return 'none';
  if (booking.status === 'completed') return 'completed';
  if (now >= booking.startsAt + INTERVIEW_WINDOW) return 'expired';
  if (now < booking.startsAt) return 'scheduled';
  return booking.status === 'started' ? 'started' : 'ready';
}
export function validateBooking(fields, now = Date.now()) {
  const fullName = fields.fullName?.trim().replace(/\s+/g, ' ') || '';
  if (fullName.length < 2 || fullName.length > 80) throw new Error('Enter your full name (2 to 80 characters).');
  const email = fields.email?.trim().toLowerCase() || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  const selected = new Date(`${fields.date}T${fields.time}`);
  const startsAt = selected.getTime();
  const [year, month, day] = (fields.date || '').split('-').map(Number);
  const [hour, minute] = (fields.time || '').split(':').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date || '') || !/^\d{2}:\d{2}$/.test(fields.time || '') || !Number.isFinite(startsAt) || startsAt <= now
    || selected.getFullYear() !== year || selected.getMonth() + 1 !== month || selected.getDate() !== day || selected.getHours() !== hour || selected.getMinutes() !== minute) throw new Error('Choose a future interview date and time.');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return { fullName, email, startsAt, timezone };
}
export function normalizeBooking(row) {
  if (!row || typeof row.id !== 'string' || !['scheduled', 'started', 'completed'].includes(row.status)) return null;
  const startsAt = row.startsAt ?? Date.parse(row.starts_at);
  const fullName = row.fullName ?? row.full_name ?? [row.firstName ?? row.first_name, row.lastName ?? row.last_name].filter(Boolean).join(' ');
  if (!Number.isFinite(startsAt) || ![fullName, row.email].every(value => typeof value === 'string' && value.trim())) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: row.timezone }).format(startsAt); } catch { return null; }
  return { id: row.id, fullName,
    email: row.email, timezone: row.timezone,
    startsAt, status: row.status, emailSentAt: row.emailSentAt ?? row.email_sent_at ?? null, synced: row.synced ?? true };
}
export function readBooking(userId) {
  if (!userId) return null;
  try { return normalizeBooking(JSON.parse(localStorage.getItem(key(userId)))); } catch { return null; }
}
export function cacheBooking(userId, booking) {
  if (!userId) throw new Error('Please log in again.');
  localStorage.setItem(key(userId), JSON.stringify(booking));
  window.dispatchEvent(new Event('issb-booking-changed'));
  return booking;
}
export async function loadBooking(client, userId) {
  const cached = readBooking(userId);
  if (!client?.from || !userId) return cached;
  try {
    const { data, error } = await client.from('issb_bookings').select('*').eq('user_id', userId).maybeSingle();
    if (error) return cached;
    // An unsynced booking must remain visible until the cadet explicitly retries saving.
    if (cached && !cached.synced) return cached;
    const booking = normalizeBooking(data);
    if (booking) { try { cacheBooking(userId, booking); } catch { /* Account copy remains available. */ } }
    return booking;
  } catch { return cached; }
}
function unavailable(error) {
  return !error || ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code) || /fetch|network/i.test(error.message || '');
}
export async function saveBooking(client, user, fields, now = Date.now()) {
  const details = validateBooking(fields, now);
  if (details.email !== user.email?.toLowerCase()) throw new Error('Use the verified email linked to your cadet account.');
  let booking = { ...details, id: createUUID(), status: 'scheduled', emailSentAt: null, synced: false };
  if (client?.rpc) {
    let response;
    try { response = await client.rpc('schedule_issb_interview', { p_full_name: details.fullName,
      p_starts_at: new Date(details.startsAt).toISOString(), p_timezone: details.timezone }); }
    catch (error) { if (!unavailable(error)) throw error; }
    if (response?.error && !unavailable(response.error)) throw new Error(response.error.message);
    if (response && !response.error) {
      booking = normalizeBooking(Array.isArray(response.data) ? response.data[0] : response.data);
      if (!booking) throw new Error('The interview could not be saved. Please try again.');
    }
  }
  try { return cacheBooking(user.id, booking); }
  catch { if (booking.synced) return booking; throw new Error('Enable browser storage or restore account saving before booking.'); }
}
export async function updateInterviewStatus(client, userId, booking, status, now = Date.now()) {
  if (!['started', 'completed'].includes(status) || !['ready', 'started'].includes(interviewState(booking, now))) throw new Error('The interview is available only during its scheduled hour.');
  if (status === 'completed' && booking.status !== 'started') throw new Error('Start the interview before completing it.');
  let updated = { ...booking, status };
  if (booking.synced) {
    const { data, error } = await client.rpc('update_issb_interview_status', { p_booking_id: booking.id, p_status: status });
    if (error) throw new Error('Unable to update your interview. Check your connection and try again.');
    updated = normalizeBooking(Array.isArray(data) ? data[0] : data);
    if (!updated) throw new Error('Your booking changed. Refresh this page before starting.');
  }
  try { return cacheBooking(userId, updated); } catch { if (updated.synced) return updated; throw new Error('Your interview could not be saved in this browser.'); }
}
