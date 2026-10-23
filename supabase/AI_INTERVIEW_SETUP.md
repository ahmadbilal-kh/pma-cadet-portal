# Live AI voice interviews

The written practice questions have been replaced by `/issb/interview`. **Start interview** opens device setup. Cadets allow camera and microphone access, play a speaker test, confirm they heard it, and click **Join fullscreen interview**. Browsers require this click for fullscreen; ordinary speaker playback does not have a separate permission prompt.

The interview is a real OpenAI Realtime voice conversation with follow-up questions, not a scripted recording or a written exam. English is the starting language; the cadet can ask to switch to Urdu. The server controls the interviewer instructions. Camera video stays on the device. Only microphone audio is sent to OpenAI. CadetPrep stores attempt metadata and outcomes, not media or conversation transcripts. OpenAI's own API data handling applies separately.

## Required setup

These changes are local source code until deployed. A Git push does not create database tables or deploy Supabase functions. No real AI calls are made by automated tests.

1. In your project's **Supabase Dashboard → SQL Editor**, run `issb-bookings.sql` if booking storage is not already installed. Then run **`issb-ai-interviews.sql`**. This adds account-owned attempt history and restricted server-only reservation/activation/result functions while preserving bookings.
2. Create an OpenAI API project at [the API platform](https://platform.openai.com/). Enable API billing and create a project API key. A ChatGPT subscription does not supply API credits. Configure project usage limits suitable for testing.
3. In **Supabase Dashboard → Edge Functions → Secrets**, add **`OPENAI_API_KEY`** with that private key. Keep it out of chat, source control, and every `VITE_*` variable.
4. Optionally set `OPENAI_REALTIME_MODEL`. The default is **`gpt-realtime-2.1`**. Your API project must have access to the chosen Realtime model.
5. Deploy the function from this repository with the Supabase CLI:

   ```powershell
   npx supabase login
   npx supabase functions deploy issb-ai-interview --project-ref YOUR_PROJECT_REF
   ```

   Deploy the full function folder, including `handler.js`, using this repository's `supabase/config.toml`. The function checks the user's signed-in JWT using `withSupabase({ auth: 'user' })`. The gateway JWT check is disabled because the wrapper validates it against project JWKS. This is an authenticated endpoint, not a public AI proxy.
6. The Edge runtime must expose `SUPABASE_URL` and the new-format publishable and secret API keys (`SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`, or their singular forms). These configure `@supabase/server`. Use project JWT signing keys compatible with JWKS. The frontend uses only its public key.
7. Run `npm install` then `npm run dev` and use **localhost** on a current desktop Chrome/Edge/Firefox browser. Production requires **HTTPS**. A plain HTTP LAN address and browsers without the Fullscreen API cannot join. Test with headphones and an actual microphone/camera.

## Interview behavior

- Permission denial, unsupported fullscreen, and an unavailable AI service remain setup errors; they do not pretend an interview has started.
- Starting is allowed before or after the selected reminder time. Initial-test passes and phone verification are not required for ISSB.
- After joining, exiting fullscreen, switching away from the visible interview, reloading, closing the page, or navigating away ends that attempt as **Interview not passed. Try again later.** Camera, microphone, and the voice connection are released. Browser navigation and crash/network shutdown can prevent the immediate server write; a pending result is retained per account and retried on the next visit.
- Camera/microphone loss and connection errors produce **Interview interrupted**, rather than claiming the cadet failed a spoken answer.
- A normal finish stops the media before exiting fullscreen and records completion. The browser ends the room at ten minutes. Completion is not an official pass or an AI selection score.
- Failed/terminal database outcomes cannot be overwritten by a later completion request. A refresh cannot resume an active attempt. Retry attempts have a one-minute cooldown and a limit of three reservations per account per hour. Stale active reservations expire after fifteen minutes.
- A fresh attempt needs new device access/checks and a new fullscreen join click. Failed attempts remain in account storage when rescheduling a booking.

The fullscreen rule is a browser UX check, not secure remote proctoring. A modified client can bypass browser checks. There is no face recognition, video analysis, biometric assessment, official selection decision, or media recording in this implementation. If a tab crashes while offline, browser unload delivery is not guaranteed; local pending results and stale reservation expiry provide recovery.

## Troubleshooting

- **AI interview storage is unavailable:** run `issb-ai-interviews.sql` in the same Supabase project used by the app.
- **Unable to reach the AI service:** deploy the function and inspect its logs; check the app's public project URL/key and the Edge runtime's JWT/JWKS configuration.
- **Server setup required:** add `OPENAI_API_KEY` in Edge Function secrets. Do not put the private key in frontend `.env`.
- **AI could not connect:** check API model access, billing, project limits, outbound connectivity, and browser WebRTC support. Provider details and credentials are not returned to the browser.
- **No sound:** replay the speaker test, check your output device/volume/site audio setting, and use headphones. Browser autoplay failure interrupts the call safely.
- **Result saved on this device:** reconnect and use **Retry saving result** before starting a fresh attempt.

## References

- [Official OpenAI WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc)
- [Official OpenAI call hangup API](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup)
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)

The server negotiates SDP with OpenAI using the unified WebRTC call flow. The permanent OpenAI API key never goes to the browser. The authenticated server reserves a booking-owned attempt before creating the paid call and stores its provider call ID privately for hangup on finish.
