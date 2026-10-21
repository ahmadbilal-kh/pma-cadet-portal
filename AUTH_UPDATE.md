# Authentication setup notes

## Forgotten passwords and email verification codes

The login page's **Forgot password?** link opens `/reset-password`. Signed-out users enter their registered email, request a recovery code, and enter the code from their email. Only successful Supabase recovery verification creates the session needed for the new-password form. The current password is no longer requested. `/forgot-password` redirects to the same page. Emails are requested only when the user submits the form, never on page load.

In your Supabase project's Authentication email templates, open **Reset password**, paste the contents of `supabase/templates/recovery.html`, and save. The template must contain `{{ .Token }}` so the user receives a code rather than only a link. This repository file does not update the hosted template automatically. See https://supabase.com/docs/guides/auth/auth-email-templates. Enable the email provider, allow your application's `/reset-password` redirect URL, and configure email delivery/SMTP for your intended recipients. Email service restrictions and rate limits still apply; test delivery to an account you own after configuration.

Invalid and expired codes cannot unlock the password form. Resend is limited to once per minute in the UI, and Supabase also enforces its own limits. Responses do not disclose whether an account exists. Expired update sessions return to email verification. Signed-in users can open **Cadet Profile → Change password** to change their own password directly; normal login does not open the recovery page. Previously verified recovery links remain supported.

Passwords and verification codes are not added to browser storage or navigation state. After a successful change, the form clears, the user is signed out, and the login page opens automatically with a success message. If sign out fails, Continue to login retries sign out without changing the password again.

## Required account storage connection

Accounts are stored in Supabase Authentication, including the email, password hash, and full name metadata. The app requires a real Supabase project; starting Vite alone does not create an account database.

1. Copy `.env.example` to `.env` if `.env` does not exist.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your project's URL and public anon/publishable key.
3. Run `supabase/schema.sql` in the project's SQL Editor to enable the optional profile and practice-result tables.
4. Enable email/password authentication and add your running app's `/login` URL to the allowed auth redirects.
5. Restart Vite after changing `.env`.

Successful signup always opens the login page and fills in the submitted email and password. If email confirmation is enabled in Supabase, users must confirm their email before login succeeds. For immediate login after registration, turn off Confirm email in the project's email authentication settings. The app follows that setting.

Validation covers full name, email, password length, and matching confirmation. Login sends the entered credentials to Supabase and requires an authenticated user and session before navigating onward. Wrong credentials and unconfirmed emails show errors. No plaintext passwords are saved to the application database or browser storage; the signup-to-login prefill exists only in memory and clears on refresh.

Run `npm.cmd test` and `npm.cmd run build` for local checks. Authentication tests use a service double; verify registration and login against your configured Supabase project as well.

For installation and running instructions, see [README.md](README.md).
