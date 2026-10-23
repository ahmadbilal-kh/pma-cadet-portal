# Mobile verification is disabled

Signup now requires a full name, email address, password, and matching confirmation password. Mobile numbers, SMS codes, and phone verification proofs are not collected or required. Supabase email confirmation still follows your project settings.

## Existing Supabase installations

If you previously ran `phone-verification.sql`, run **[remove-signup-phone-verification.sql](remove-signup-phone-verification.sql)** in your project's Supabase SQL Editor. This removes the `require_cadet_signup_phone` trigger and its function, while preserving existing users and stored phone records. Deploy the updated frontend alongside this database change.

New installations do not need the phone verification SQL, Twilio credentials, or the phone-verification Edge Function. The legacy SMS component, helpers, and service files remain unused by signup; their standalone tests remain for those utilities. The legacy SQL script no longer installs the signup gate, so rerunning it cannot restore the requirement.

ISSB preparation and Cadet Profile also do not require mobile verification. AI voice interview setup is documented separately in [AI_INTERVIEW_SETUP.md](AI_INTERVIEW_SETUP.md).
