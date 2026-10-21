import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { handlePhoneVerification } from './handler.js';

export default {
  fetch: withSupabase({ auth: 'publishable', errors: { detailed: false } }, async (request, context) => {
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    if (Number(request.headers.get('content-length')) > 4096) return Response.json({ error: 'Request too large' }, { status: 413 });
    let body;
    try {
      const text = await request.text();
      if (text.length > 4096) return Response.json({ error: 'Request too large' }, { status: 413 });
      body = JSON.parse(text);
    } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
    const result = await handlePhoneVerification(body, context, {
      accountSid: Deno.env.get('TWILIO_ACCOUNT_SID'), authToken: Deno.env.get('TWILIO_AUTH_TOKEN'), serviceSid: Deno.env.get('TWILIO_VERIFY_SERVICE_SID'),
    });
    return Response.json(result.body, { status: result.status });
  }),
};
