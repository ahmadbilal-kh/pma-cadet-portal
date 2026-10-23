import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { handleAiInterview } from './handler.js';

export default {
  fetch: withSupabase({ auth: 'user', errors: { detailed: false } }, async (request, context) => {
    return handleAiInterview(request, {
      db: context.supabaseAdmin,
      userId: context.userClaims!.id,
      apiKey: Deno.env.get('OPENAI_API_KEY'),
      model: Deno.env.get('OPENAI_REALTIME_MODEL') || 'gpt-realtime-2.1',
    });
  }),
};
