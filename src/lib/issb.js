export { countries } from './countries.js';

export const INTERVIEW_WINDOW = 60 * 60 * 1000;
export const REMINDER_LEAD = 15 * 60 * 1000;

const key = id => `cadetprep:${id}:issb-booking`;
export function interviewState(booking, now = Date.now()) {
  if (!booking) return 'none';
  if (booking.status === 'completed') return 'completed';
  if (booking.status === 'started') return 'started';
  if (now < booking.startsAt) return 'scheduled';
  return 'ready';
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
    const booking = normalizeBooking(data);
    // Reconcile a successful save whose response was lost, without hiding a different local slot.
    if (cached && !cached.synced && (!booking || !sameAppointment(cached, booking))) return cached;
    if (booking) { try { cacheBooking(userId, booking); } catch { /* Account copy remains available. */ } }
    return booking;
  } catch { return cached; }
}
function sameAppointment(left, right) {
  return left.startsAt === right.startsAt && left.fullName === right.fullName
    && left.email.toLowerCase() === right.email.toLowerCase() && left.timezone === right.timezone;
}
function accountSaveError(error) {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) {
    return new Error('Account booking is not set up yet. Run supabase/issb-bookings.sql in your project’s Supabase SQL Editor, then retry saving.');
  }
  if (!error || /fetch|network/i.test(error.message || '')) return new Error('Unable to save to your account. Check your connection and try again.');
  return new Error(error.message || 'Unable to save your interview. Please try again.');
}
async function saveToAccount(client, user, details) {
  if (!user?.id) throw new Error('Please log in again.');
  if (details.email.toLowerCase() !== user.email?.toLowerCase()) throw new Error('Use the verified email linked to your cadet account.');
  if (!client?.rpc) throw accountSaveError();
  let response;
  try {
    response = await client.rpc('schedule_issb_interview', { p_full_name: details.fullName,
      p_starts_at: new Date(details.startsAt).toISOString(), p_timezone: details.timezone });
  } catch (error) { throw accountSaveError(error); }
  if (response?.error) throw accountSaveError(response.error);
  const booking = normalizeBooking(Array.isArray(response?.data) ? response.data[0] : response?.data);
  if (!booking) throw new Error('The interview could not be saved. Please try again.');
  try { cacheBooking(user.id, booking); } catch { /* Account copy remains available. */ }
  return booking;
}
export async function saveBooking(client, user, fields, now = Date.now()) {
  const details = validateBooking(fields, now);
  return saveToAccount(client, user, details);
}
export async function retryBookingSave(client, user, pending, now = Date.now()) {
  const booking = normalizeBooking(pending);
  if (!booking || booking.synced) throw new Error('Reload your interview schedule before retrying.');
  if (booking.status !== 'scheduled') throw new Error('Choose a new schedule to save your next interview to your account.');
  // Use the stored instant and timezone, even if the cadet has travelled since booking.
  const existing = await loadBooking(client, user.id);
  if (existing?.synced && sameAppointment(booking, existing)) return existing;
  if (booking.startsAt <= now) throw new Error('This time has already passed. Reschedule your interview to save it to your account.');
  return saveToAccount(client, user, booking);
}
export async function updateInterviewStatus(client, userId, booking, status) {
  if (!booking || !['started', 'completed'].includes(status) || !['scheduled', 'started'].includes(booking.status)) throw new Error('Choose an available interview before starting.');
  if (status === 'completed' && booking.status !== 'started') throw new Error('Start the interview before completing it.');
  let updated = { ...booking, status };
  if (booking.synced) {
    const { data, error } = await client.rpc('update_issb_interview_status', { p_booking_id: booking.id, p_status: status });
    if (error) {
      if (error.code === 'P0001' && /not available at this time/i.test(error.message || '')) throw new Error('Your server still requires the scheduled time. Run supabase/issb-start-anytime.sql in Supabase SQL Editor, then click Start interview again.');
      throw new Error('Unable to update your interview. Check your connection and try again.');
    }
    updated = normalizeBooking(Array.isArray(data) ? data[0] : data);
    if (!updated) throw new Error('Your booking changed. Refresh this page before starting.');
  }
  try { return cacheBooking(userId, updated); } catch { if (updated.synced) return updated; throw new Error('Your interview could not be saved in this browser.'); }
}
