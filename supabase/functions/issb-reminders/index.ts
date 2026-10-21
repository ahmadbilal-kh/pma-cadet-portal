import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { sendInterviewReminders } from './worker.js';

export default {
  fetch: withSupabase({ auth: 'secret', cors: false, errors: { detailed: false } }, async (request, context) => {
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const result = await sendInterviewReminders(context.supabaseAdmin, {
      apiKey: Deno.env.get('RESEND_API_KEY'),
      from: Deno.env.get('INTERVIEW_EMAIL_FROM'),
      appUrl: Deno.env.get('APP_URL'),
    });
    return Response.json(result.body, { status: result.status });
  }),
};
