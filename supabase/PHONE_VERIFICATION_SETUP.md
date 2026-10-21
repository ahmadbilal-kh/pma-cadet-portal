# Enable mobile verification

This integration is for signup only. ISSB booking and Cadet Profile have no phone fields, verification prompts, or phone dependencies. Set up the provider and deploy the function before using real SMS signup; repository publication does not configure the hosted service.

## 1. Create the SMS service

1. Create a [Twilio account](https://www.twilio.com/try-twilio).
2. Open **Verify → Services** in the Twilio Console and create a service called **CadetPrep**.
3. Enable SMS and set the code length to **6 digits**. Keep Fraud Guard enabled.
4. Enable your destination countries in Verify Geo Permissions, including Pakistan if that is your audience.
5. Note your Account SID, Auth Token, and Verify Service SID. Keep the Auth Token private.

Twilio trial accounts restrict which numbers can receive messages. Verify your own recipient number in Twilio for testing; review the account's current trial restrictions and available balance before enabling public signup. See [Twilio's prerequisites](https://www.twilio.com/docs/verify/api/verification).

## 2. Configure Supabase

Run these SQL files in the Supabase SQL Editor in this order:

1. `schema.sql`
2. `phone-verification.sql`
ISSB setup is independent: run `issb-bookings.sql` separately if using interview booking.

`issb-bookings.sql` joins existing first/last names into `full_name` before removing the old columns. Local saved bookings with the previous name format are still readable. The signup trigger requires SMS verification for **new accounts**; existing accounts can still log in and recover passwords. Admin-created accounts and alternative signup providers also need a verified proof with this trigger enabled. Review those flows before enabling additional auth providers.

Set the following in **Supabase → Edge Functions → Secrets**, never in a `VITE_*` variable or a tracked file:

```dotenv
TWILIO_ACCOUNT_SID=YOUR_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID=YOUR_VERIFY_SERVICE_SID
```

The server also needs the new-format Supabase publishable and secret keys and JWT signing keys described in `ISSB_SETUP.md`. The secret key is used server-side only. The public browser key authenticates signup verification requests; the endpoint accepts only registration verification requests.

After reviewing deployment, deploy `phone-verification` through the Supabase Dashboard or CLI:

```powershell
supabase functions deploy phone-verification --project-ref YOUR_PROJECT_REF
```

Keep the `verify_jwt = false` setting from `config.toml`: the server wrapper validates the publishable key itself. The endpoint never accepts anonymous requests without a valid project key. A public key identifies the project; it is not a private anti-abuse credential.

Coordinate deployment of the UI, function, and signup trigger so new registrations are not exposed to a partially configured flow. The app deliberately blocks new signup until the mobile number is verified. Interview scheduling and profile editing do not require a number. A missing service reports setup/unavailability instead of pretending to send a code.

## 3. Test the flow

1. Enter your full name and email on Signup.
2. Choose the phone country code, enter exactly 10 national digits (for example `3001234567`), and click **Send SMS code**.
3. Enter the received 6-digit code and click **Verify code**.
4. Complete the password fields and submit registration. You will return to login with the usual credential prefill; email confirmation still follows your existing Supabase setting.


Changing the number, country code, or email clears verification. Codes and unconsumed signup proofs expire after 10 minutes. Resending waits 60 seconds; the server allows at most 3 sends per number in 15 minutes and 100 sends across the project per hour. It allows at most 5 code-check attempts per challenge. These server limits are in `phone-verification.sql`; adjust only after reviewing usage and the provider's budget controls. Configure provider country permissions and service rate limits for your production traffic.

SMS codes and provider tokens are never returned to the browser. The browser holds a random challenge secret in memory until registration; only its SHA-256 hash is stored server-side. The database signup trigger checks the email, phone, verified state, expiry and unused proof, consumes it atomically, and strips the challenge secret from user metadata. No SMS proof or code is added to browser storage, login navigation state, or test history.

Completed signup proofs remain associated with the account. Clean up expired unused challenges according to your retention policy; deleting an account removes its associated proofs through the foreign key.

## Interview access and date selection

There is no simulated phone verification or separate preview mode. Old preview URLs redirect to the normal ISSB page. Every signup code request uses the real SMS service. Without provider credentials or a deployed function, the app reports setup/unavailability and does not label the number verified.

The new date defaults to today's local date and the clock defaults to **10:00 AM**. If that time has already passed, choose a future time/date. The digital time controls offer all minutes and both AM/PM, including midnight and noon. A styled month calendar supports date selection; past days cannot be selected.

Automated tests use fake SMS/database responses and do not send messages. Live delivery, the SQL migration, and the auth trigger must be verified against your configured Supabase/Twilio projects.

API references: [Send a verification](https://www.twilio.com/docs/verify/api/verification), [Check a verification](https://www.twilio.com/docs/verify/api/verification-check).

When upgrading, re-run `phone-verification.sql` and redeploy `phone-verification`. Only `registration` requests are accepted; the earlier profile phone-saving RPC is removed. Old profile verification rows, if present, are retained for migration compatibility but cannot be used for new signup proofs.
