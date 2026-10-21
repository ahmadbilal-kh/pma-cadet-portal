// Kept independent of the Edge runtime so the email queue can be tested locally.
export async function sendInterviewReminders(database, settings, request = fetch) {
  if (!settings.apiKey || !settings.from || !settings.appUrl) return { status: 503, body: { error: 'Interview reminder email service is not configured.' } };
  let appUrl;
  try { appUrl = new URL('/issb', settings.appUrl); if (!['https:', 'http:'].includes(appUrl.protocol)) throw new Error(); }
  catch { return { status: 503, body: { error: 'Invalid reminder app URL.' } }; }
  const { data, error } = await database.rpc('claim_issb_reminders');
  if (error || !Array.isArray(data)) return { status: 500, body: { error: 'Unable to claim interview reminders.' } };
  let sent = 0, failed = 0;
  for (const booking of data) {
    try {
      // Recheck just before delivery in case the cadet rescheduled or started.
      const { data: current, error: readError } = await database.from('issb_bookings').select('id,status,email_claim').eq('id', booking.id).maybeSingle();
      if (readError) throw new Error('Read failed');
      if (!current || current.status !== 'scheduled' || current.email_claim !== booking.email_claim) continue;
      const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: booking.timezone }).format(new Date(booking.starts_at));
      const response = await request('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `issb-reminder/${booking.id}` },
        body: JSON.stringify({ from: settings.from, to: [booking.email], subject: 'Your CadetPrep mock interview starts soon',
          text: `Hello ${booking.full_name || booking.first_name || 'Cadet'},\n\nYour ISSB mock interview is scheduled for ${date} (${booking.timezone}).\n\nOpen your schedule: ${appUrl.href}\nThe Start interview button unlocks at your selected time and remains available for one hour.\n\nThis is independent practice, not an official ISSB appointment.\nCadetPrep` }),
      });
      if (!response.ok) throw new Error('Email provider rejected the request');
      const { error: updateError } = await database.from('issb_bookings').update({ email_state: 'sent', email_sent_at: new Date().toISOString() }).eq('id', booking.id).eq('email_claim', booking.email_claim);
      if (updateError) throw new Error('Email status could not be saved');
      sent++;
    } catch {
      failed++;
      // Leave the claim timestamp in place for a 5-minute backoff. The same
      // idempotency key makes a retry safe if delivery succeeded before DB failure.
      await database.from('issb_bookings').update({ email_state: 'pending' }).eq('id', booking.id).eq('email_claim', booking.email_claim);
    }
  }
  return { status: failed ? 502 : 200, body: { claimed: data.length, sent, failed } };
}
