# Running the tests

From the project folder:

```powershell
npm.cmd test
```

This runs all 138 tests: 46 Node unit tests and 92 component tests in jsdom.

To run one group:

```powershell
npm.cmd run test:unit
npm.cmd run test:ui
```

To run the new user-flow tests only:

```powershell
npm.cmd run test:ui -- tests/auth-flow.ui.test.jsx tests/exam-flow.ui.test.jsx
```

## Coverage

- `auth.test.js`: account validation, auth-service requests, errors, and one-use credential handoff.
- `avatar.test.js`: accepted avatar image types and file size restrictions. Profile/context tests also cover uploads, removal, signed URLs, failed uploads, cleanup after failed saves, header display, and fallback initials.
- `testHistory.test.js`: completed-result validation, local history archives, account isolation, merging and deduplication, paginated account reads, device fallback, and summary calculations.
- `history.ui.test.jsx`: dashboard navigation, empty history, score charts, category/result/date filters, account-read failures and refresh recovery, pagination, route protection, the first-test popup, all three instruction destinations, and keyboard dismissal/reopening.
- `exam.test.js`: scoring, deadlines, passing, answer locking, skip navigation, and fresh question generation.
- `uuid.test.js`: native UUID support, secure fallback IDs, and generated papers and attempts when `crypto.randomUUID` is unavailable.
- `passwordRecovery.test.js`: reset-email requests, callback URLs, email limits, password confirmation, and expired sessions.
- `password-recovery.ui.test.jsx`: requesting and verifying email recovery codes, invalid-code blocking, delivery failures, resend throttling, direct signed-in password changes, duplicate submission prevention, visibility toggles, recovery routing, and automatic logout/login redirect after a password change.
- `navigation.ui.test.jsx`: sidebar links, Home and Back navigation, refresh/retry, route protection, and active-paper preservation.
- `refresh.ui.test.jsx`: loading saved account details, refresh failures, profile metadata saves and validation, service failures, and sign-out during pending requests.
- `profile.ui.test.jsx`: profile navigation, account details, read-only email, saving a name and updating the dashboard greeting, route protection, retry after a failed save, and duplicate-submission prevention.
- `auth-flow.ui.test.jsx`: real signup/login forms in React StrictMode, prefilled credentials, confirmation notices, password clearing after remount, mismatch errors, email limits, duplicate submissions, and dashboard navigation.
- `exam-flow.ui.test.jsx`: neutral locked answers, grading only after confirmed submission or expiry, direct question selection, allowed tab switching, discarding unfinished attempts on return, preserving submitted results and question history, save retry, and unavailable browser storage.
- `test-preparation.ui.test.jsx`: immediate instructions without a loading delay, hiding prior results while preserving storage, starting a full 30-minute timer after clicking Start, reopening the same category, and no automatic start while reading instructions.

The new auth and exam flow tests replace Supabase with service doubles. They do not create real accounts, send emails, or write results to the remote database. They check DOM interactions rather than visual layout; live Supabase integration and browser appearance still need separate verification.
- `entrypoint.ui.test.jsx`: boots the actual `main.jsx` entry point and navigates from the landing page to login and email-code recovery, catching disconnected routing after accidental reversions.
