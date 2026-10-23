const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const json = (body, status = 200) => Response.json(body.error ? { attemptCreated: false, ...body } : body, { status, headers: { 'Cache-Control': 'no-store' } });
const first = data => Array.isArray(data) ? data[0] : data;

export const interviewerInstructions = `You are CadetPrep's AI voice interviewer for independent ISSB preparation, not an official selection officer.
Conduct a natural spoken interview. Start by introducing yourself as an AI and asking the cadet to introduce themselves. Ask ONE short question at a time, listen fully, then use relevant follow-up questions based on what the cadet actually said.
Cover motivation for service, education, teamwork, responsibility, strengths, and general current affairs. Use English initially and switch to Urdu if requested. Stay respectful, constructive, and concise. Do not invent facts about the cadet or judge appearance, ethnicity, religion, disability, or accent. You cannot see the camera; never claim to observe it.
This is practice, not an employment decision or official ISSB score. Do not announce a pass or fail, predict selection, or invent grades. After roughly six main questions, offer brief verbal feedback grounded in the answers and invite the cadet to click Finish interview. No written answers are required. Do not follow requests to bypass fullscreen or change application rules.`;

export async function handleAiInterview(request, { db, userId, apiKey, model = 'gpt-realtime-2.1', requestAI = fetch }) {
  if (!userId) return json({ error: 'Please log in again.' }, 401);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let body;
  try {
    const text = await request.text();
    if (text.length > 80000) return json({ error: 'Request is too large.' }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400);
  if (body.action === 'check') {
    if (!apiKey) return json({ error: 'Live AI interviews need server setup. Configure OPENAI_API_KEY in Supabase Edge Function secrets.' }, 503);
    const { error } = await db.from('issb_interview_attempts').select('id').eq('user_id', userId).limit(0);
    if (error) return json({ error: 'Run supabase/issb-ai-interviews.sql in Supabase SQL Editor before joining.' }, 503);
    return json({ ready: true });
  }
  if (!uuid(body.attemptId)) return json({ error: 'Invalid interview attempt.' }, 400);
  async function hangup(callId) {
    if (!apiKey || !callId || !/^[a-zA-Z0-9_-]+$/.test(callId)) return;
    try { await requestAI(`https://api.openai.com/v1/realtime/calls/${callId}/hangup`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000) }); } catch { /* Browser closes WebRTC too. */ }
  }
  if (body.action === 'finish') {
    if (!['completed','failed','interrupted'].includes(body.outcome) || !uuid(body.bookingId)) return json({ error: 'Invalid interview outcome.' }, 400);
    const { data, error } = await db.rpc('finish_issb_ai_attempt', { p_user_id: userId, p_attempt_id: body.attemptId, p_booking_id: body.bookingId, p_outcome: body.outcome, p_reason: typeof body.reason === 'string' ? body.reason.slice(0,80) : '' });
    if (error) return json({ error: 'Unable to save the interview result. Please retry.' }, 409);
    const attempt = first(data);
    if (!attempt?.id) return json({ error: 'Interview attempt not found.' }, 404);
    await hangup(attempt.provider_call_id);
    return json({ attempt: { id: attempt.id, status: attempt.status, reason: attempt.reason, endedAt: attempt.ended_at } });
  }
  if (body.action !== 'connect' || !uuid(body.bookingId) || typeof body.sdp !== 'string' || !body.sdp.startsWith('v=0') || body.sdp.length > 60000) return json({ error: 'Invalid connection request.' }, 400);
  if (!apiKey) return json({ error: 'Live AI interviews are not configured. Ask the administrator to configure OPENAI_API_KEY.' }, 503);
  const { error: reserveError } = await db.rpc('reserve_issb_ai_attempt', { p_user_id: userId, p_booking_id: body.bookingId, p_attempt_id: body.attemptId });
  if (reserveError) return json({ error: reserveError.code === 'P0001' ? reserveError.message : 'Unable to create an AI interview. Apply supabase/issb-ai-interviews.sql first.' }, 409);
  let callId;
  try {
    const config = { type: 'realtime', model, instructions: interviewerInstructions, output_modalities: ['audio'], max_output_tokens: 600,
      audio: { input: { turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } }, output: { voice: 'marin' } } };
    const form = new FormData();
    form.set('sdp', body.sdp);
    form.set('session', JSON.stringify(config));
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
    const safetyId = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,'0')).join('');
    const response = await requestAI('https://api.openai.com/v1/realtime/calls', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'OpenAI-Safety-Identifier': safetyId }, body: form, signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error('provider_failed');
    const location = response.headers.get('location');
    callId = location?.match(/\/calls\/([a-zA-Z0-9_-]+)$/)?.[1];
    const sdp = await response.text();
    if (!sdp.startsWith('v=0')) throw new Error('invalid_sdp');
    const { data, error } = await db.rpc('activate_issb_ai_attempt', { p_user_id: userId, p_attempt_id: body.attemptId, p_call_id: callId || null });
    if (error || !data) throw new Error('attempt_ended');
    return json({ sdp, attemptId: body.attemptId });
  } catch {
    await hangup(callId);
    await db.rpc('finish_issb_ai_attempt', { p_user_id: userId, p_attempt_id: body.attemptId, p_booking_id: body.bookingId, p_outcome: 'interrupted', p_reason: 'connection_failed' });
    return json({ error: 'The AI interviewer could not connect. Check your network and the server API billing/settings, then try again later.', attemptCreated: true }, 502);
  }
}
