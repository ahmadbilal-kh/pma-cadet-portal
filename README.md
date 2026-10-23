# CadetPrep — PMA Cadet Portal

A React application for PMA preparation, with cadet accounts, timed practice tests, profile photos, and test history and progress charts.

Independent preparation platform; not affiliated with Pakistan Military Academy or the Pakistan Army.

## Use the public website

**[Open CadetPrep](https://cadetprep-pma-portal.dusky-maple-8683.chatgpt.site)**

Visitors can open this link, create an account, and log in from another device. They do not need to clone this repository, install Node.js, create a Supabase project, or configure an `.env` file. The hosted build connects to the portal's shared Supabase project using its public client configuration. The setup instructions below are for developers running their own copy.


## Features

- Public landing page and a protected dashboard for signed-in cadets.
- Signup, login, email-code password recovery, and automatic return to login after a password change.
- Signup requires a full name, email, password, and matching confirmation password. No phone number or SMS verification is required. If the earlier SMS signup gate was installed, run [remove-signup-phone-verification.sql](supabase/remove-signup-phone-verification.sql) in Supabase SQL Editor.
- Cadet profiles with editable names and private profile-photo uploads.
- Separate Verbal Intelligence, Non-Verbal Intelligence, and Academic Preparation tests.
- A stored bank of 515 questions, extended with generated practice variants.
- 85 questions per test, a 30-minute timer, and a passing score of 64 correct answers.
- Question navigation, answer locking, skipping, and results after submission or timer expiry.
- Interactive progress charts, category averages, test history, filters, and pagination.
- Account-owned results in Supabase, with browser history available when account saving is unavailable.
- A first-test popup offering all three training areas to cadets without completed tests.
- ISSB preparation for every signed-in cadet, with interview booking, a designed calendar, scheduled start times, and in-app reminders.
- A prepared server-side email reminder queue; see the additional setup below before enabling delivery.
- Responsive desktop and mobile layouts.

## Requirements

- **Node.js 24 LTS** and npm. Older Node.js 18/20 installations are not supported by all current dependencies.
- Git, to clone the repository.
- A Supabase project with email/password authentication enabled.

Check your installation:

```powershell
node --version
npm.cmd --version
git --version
```

## 1. Download and install

Open a PowerShell terminal in VS Code or Visual Studio:

```powershell
git clone https://github.com/ahmadbilal-kh/pma-cadet-portal.git
cd pma-cadet-portal
npm.cmd ci
```

A private repository requires GitHub access. If the project is already on your computer, open its folder and run `npm.cmd ci` there instead.

On macOS/Linux, use `npm` in place of `npm.cmd` in these commands.

## 2. Configure the environment

For a new clone, create the local environment file:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env`. Keep an existing `.env` rather than overwriting it.

Edit `.env` with values from your Supabase project:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Use a **public publishable or anon key**. Vite exposes `VITE_*` variables to the browser. Never put a Supabase secret/service-role key, SMTP password, or GitHub token in these variables. `.env` is excluded from Git.

Restart the development server after changing environment values.

## 3. Set up Supabase

In your Supabase project's **SQL Editor**, run these files in order:

1. [`supabase/schema.sql`](supabase/schema.sql) — creates profiles and practice-attempt tables, ownership policies, and a history index.
2. [`supabase/avatar-storage.sql`](supabase/avatar-storage.sql) — creates the private avatar bucket and account-owned upload/read/delete policies.

Starting Vite does not apply these scripts to your hosted project.

In **Authentication**:

1. Enable the email/password provider and allow new signups.
2. Set the development **Site URL** to `http://localhost:5173`.
3. Add `http://localhost:5173/login` and `http://localhost:5173/reset-password` to allowed redirect URLs.
4. If email confirmation is enabled, users must confirm their email before signing in.

Use the actual origin printed by Vite if it chooses a different port. Add your deployed site's origin and redirect URLs when deploying.

### Password recovery emails

For verification-code recovery:

1. Configure a custom SMTP provider in Supabase Authentication settings.
2. Open the **Reset password** email template and replace its body with [`supabase/templates/recovery.html`](supabase/templates/recovery.html).
3. Save the template. It must include `{{ .Token }}` to display the verification code.
4. Request a new recovery email from the app and use its code.

SMTP credentials belong in Supabase's SMTP settings, not in this repository. Email delivery limits and the minimum interval between requests still apply.

## 4. Run locally

ISSB and Cadet Profile do not collect or require phone numbers. For ISSB account booking and email reminders, follow [`supabase/ISSB_SETUP.md`](supabase/ISSB_SETUP.md). Run the additional booking SQL and configure the reminder function and scheduler to enable email delivery. Local-only bookings are clearly labeled in the app.

```powershell
npm.cmd run dev
```

Open the URL printed in the terminal, usually **http://localhost:5173**. Keep the terminal running. Press **Ctrl+C** to stop it.

For subsequent Windows starts, you can also double-click [`start-windows.cmd`](start-windows.cmd).

The app shows the landing page when signed out. After login, Home opens the dashboard. Registering opens the login form with the entered credentials filled in for that immediate navigation.

## Tests and production build

```powershell
npm.cmd test
npm.cmd run build
```

Run individual test groups:

```powershell
npm.cmd run test:unit
npm.cmd run test:ui
```

Preview the production build locally:

```powershell
npm.cmd run preview
```

Vite writes the production files to `dist/`. Preview serves that build for local checking. See [`tests/README.md`](tests/README.md) for coverage. Tests use service doubles and do not send real recovery emails or create real Supabase accounts.

## Deployment

Use `npm ci` as the install command, `npm run build` as the build command, and `dist` as the output directory. Configure both public `VITE_SUPABASE_*` variables on the hosting service before building.

This is a single-page application. Requests such as `/profile`, `/progress`, `/login`, and `/test/verbal` must fall back to `index.html`. [`vercel.json`](vercel.json) configures this routing behavior on Vercel.

## Project structure

```text
src/
  components/   Shared navigation, avatars, charts, and dialogs
  context/      Authentication and account state
  data/         Question bank and question generators
  exam/         Test generation, timer, navigation, and scoring
  lib/          Authentication, image processing, and history helpers
  pages/        Landing, login/signup, dashboard, profile, tests, and progress
  styles.css    Shared styles
  dashboard.css Dashboard, profile, and progress styles
supabase/
  schema.sql            Profiles and test-result database setup
  avatar-storage.sql    Private profile-photo storage setup
  templates/            Recovery email template
tests/          Unit and component tests
scripts/        Question-bank maintenance tools
```

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `npm` or `node` is not recognized | Install Node.js 24 LTS, then reopen the terminal. |
| PowerShell blocks `npm.ps1` | Use the `npm.cmd` commands shown above. |
| `vite` is not recognized | Run `npm.cmd ci` inside the project folder. |
| Accounts are unavailable | Check `.env`, the public project key, and the enabled email provider; restart Vite. |
| Email signups are disabled | Enable new email/password signups in Supabase Authentication. |
| Recovery email contains a link instead of a code | Save the recovery template containing `{{ .Token }}` and request a new email. |
| Recovery email fails or is rate-limited | Check Supabase Auth logs, SMTP credentials, and email rate limits. |
| Profile-photo upload needs setup | Run `supabase/avatar-storage.sql` in the SQL Editor. |
| Results are saved only on this device | Run `supabase/schema.sql` and check the connection and Auth logs. |
| A deployed page returns 404 after refreshing | Configure the hosting service's SPA fallback to `index.html`. |

## Practice-data limitations

Scores and deadlines are computed in the browser; saved summaries are client-reported. This app is for practice, not secure examination or proctoring. Bundled question answer keys can be inspected.

Leaving or reloading an unfinished test abandons it without adding a result. New completed attempts are retained in browser history and saved to the account when available. Local history and seen-question tracking are specific to an account in that browser; clearing browser storage removes those local records. Older unsaved results that were overwritten before history archiving was added cannot be recovered.

## AI voice interviews

ISSB uses a fullscreen AI voice interview with camera/microphone setup and a speaker check. Set up the account-owned attempt tables, Supabase Edge Function, and private OpenAI API key using [AI_INTERVIEW_SETUP.md](supabase/AI_INTERVIEW_SETUP.md). No private provider key belongs in the frontend.
