# ISSB mock interviews and reminders

Database scripts and Edge Functions require separate Supabase setup. Pushing this repository does not apply migrations or activate email delivery.

## Booking flow

Every signed-in cadet can open `/issb`, including cadets who have never taken an initial test. There are no initial-score requirements, lock icons, or separate development preview. The sidebar and dashboard link to ISSB preparation. Old `/issb/preview` URLs redirect to `/issb`.

The form collects one full name, the account email, interview date, and interview time. It has no phone or country fields and does not require SMS verification or a profile number. The designed calendar defaults to today, and digital time controls default to 10:00 AM. The selected timezone and UTC appointment time are saved. The account email is read-only.

The start button unlocks at the selected time for one hour. Missed slots can be rescheduled. This starts a self-guided mock interview with six prompts and temporary notes, without audio recording, AI scoring, a live interviewer, or an official ISSB booking. Reloading a started session returns to the first prompt; temporary notes clear. Completed practice can be booked again.

## Enable account booking

Run `schema.sql`, then `issb-bookings.sql` in the Supabase SQL Editor. ISSB has no dependency on the signup SMS schema. The booking script creates account-owned storage and restricted scheduling/status functions. When upgrading, it removes the earlier initial-pass and phone requirements, replaces old RPC signatures, and removes the old booking phone/country columns. Reapply this script if a previous version was installed.

If the booking table/functions are unavailable, the browser can retain a local booking and clearly labels it. Email reminders require account saving. `Reschedule / sync` retries saving. Browser storage is scoped to the signed-in account; clearing it deletes unsynced bookings. Starting an account booking requires a successful server update during its scheduled hour. Existing cached bookings remain readable, but legacy phone/country values are discarded during normalization.

## Enable email reminders

Supabase Auth SMTP handles account recovery messages; it does not automatically send arbitrary interview reminders. This worker uses the Resend Email API. Configure a verified sender in Resend, then set these **server-side Supabase Edge Function secrets**:

```dotenv
RESEND_API_KEY=YOUR_RESEND_API_KEY
INTERVIEW_EMAIL_FROM=CadetPrep <interviews@YOUR_VERIFIED_DOMAIN>
APP_URL=https://YOUR_PORTAL_DOMAIN
```

Do not add these values to `.env` variables prefixed with `VITE_`. Do not paste real values into a tracked file or chat. `APP_URL` must be the real publicly reachable portal URL; localhost links will not work on another device.

The installed `@supabase/server` uses new-format publishable/secret keys. Its Edge runtime must expose `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` (or their singular equivalents), and the project must use JWT signing keys. The worker authenticates **only** a default secret API key in the `apikey` header; browser callers are not allowed to trigger the reminder queue.

After reviewing and approving deployment, deploy the `issb-reminders` Edge Function with the Supabase CLI or Dashboard. CLI example:

```powershell
supabase functions deploy issb-reminders --project-ref YOUR_PROJECT_REF
```

`config.toml` disables the gateway's legacy JWT check for this function; `withSupabase({ auth: 'secret' })` still authenticates the request. No unauthenticated mail endpoint is created.

Enable the **Cron** and **pg_net** extensions in Supabase. In **Vault**, create:

- `issb_project_url`: the project URL.
- `issb_scheduler_key`: the project's **default new-format secret API key**, matching the Edge runtime's default secret key. Never a public client key.

Then run `issb-reminder-schedule.sql`. It schedules one queue run each minute. The worker claims at most 25 due reminders, starting 15 minutes before the interview, with leases, 5-minute retry backoff, a maximum of 5 attempts, and per-booking email idempotency keys. Late bookings receive a reminder on the next run before the slot begins. Expired, completed, and started slots are excluded; rescheduling resets the reminder and replaces the booking ID. A concurrent reschedule just after the worker's final check can still allow the old reminder to arrive; the schedule page always shows the current slot.

Check Edge Function logs, `issb_bookings.email_state/email_attempts/email_sent_at`, Cron run history, and the Resend dashboard for delivery. A successful API response means the provider accepted the message; inbox delivery is not guaranteed. The portal shows “requested” until the worker records a successful send. In-app reminders appear while the portal is open from 15 minutes before the slot until the end of its one-hour start window. They are hidden during another timed test and on the booking page, which already shows the schedule.

No real emails are sent by the automated tests. The worker can be tested with fake database and fetch clients; live email delivery and SQL migration require your configured Supabase project.

References: [Supabase Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

Country flag SVGs are from [flag-icons](https://github.com/lipis/flag-icons), used under the MIT license retained at `src/assets/flags/LICENSE.txt`.
