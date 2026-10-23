import { createUUID } from './uuid.js';

export const MAX_INTERVIEW_MS = 10 * 60 * 1000;
const attemptKey = userId => `cadetprep:${userId}:ai-interview`;
export function rememberAttempt(userId, attempt) {
  localStorage.setItem(attemptKey(userId), JSON.stringify(attempt));
}
export function forgetAttempt(userId) {
  try { localStorage.removeItem(attemptKey(userId)); } catch { /* Storage may be disabled. */ }
}
export function rememberedAttempt(userId) {
  try { const value = JSON.parse(localStorage.getItem(attemptKey(userId))); return value?.id && value?.bookingId ? value : null; } catch { return null; }
}
export function mediaError(error) {
  if (['NotAllowedError','PermissionDeniedError'].includes(error?.name)) return 'Allow camera and microphone access in your browser, then try again.';
  if (error?.name === 'NotFoundError') return 'Connect a camera and microphone before joining.';
  if (error?.name === 'NotReadableError') return 'Your camera or microphone is being used by another app. Close it and try again.';
  return error?.message || 'Unable to prepare your devices. Please try again.';
}
export async function interviewRequest(client, body) {
  if (!client?.functions?.invoke) throw new Error('Live interviews need the issb-ai-interview Supabase function. Follow supabase/AI_INTERVIEW_SETUP.md.');
  const { data, error } = await client.functions.invoke('issb-ai-interview', { body, timeout: 40000 });
  if (error) {
    let detail;
    try { detail = await error.context?.json(); } catch { /* Network errors have no JSON response. */ }
    const failure = new Error(detail?.error || 'Unable to reach the AI interview service. Check your connection and Supabase function setup.');
    failure.attemptCreated = detail?.attemptCreated;
    throw failure;
  }
  if (data?.error) { const failure = new Error(data.error); failure.attemptCreated = data.attemptCreated; throw failure; }
  return data;
}
export async function finishAiAttempt(client, userId, attempt, outcome, reason) {
  const pending = { ...attempt, status: outcome, reason, endedAt: new Date().toISOString(), pending: true };
  try { rememberAttempt(userId, pending); } catch { /* Account saving remains available without local storage. */ }
  const data = await interviewRequest(client, { action: 'finish', attemptId: attempt.id, bookingId: attempt.bookingId, outcome, reason });
  if (!data?.attempt?.status) throw new Error('Unable to save the interview result. Please retry.');
  const saved = { ...pending, ...data.attempt, pending: false };
  try { rememberAttempt(userId, saved); } catch { /* Account copy remains available. */ }
  return saved;
}
export async function latestAiAttempt(client, userId, bookingId) {
  const cached = rememberedAttempt(userId);
  if (cached?.bookingId === bookingId && (cached.pending || ['active','connecting'].includes(cached.status))) {
    return finishAiAttempt(client, userId, cached, cached.pending ? cached.status : 'failed', cached.pending ? cached.reason : 'page_left');
  }
  if (!client?.from) return cached?.bookingId === bookingId ? cached : null;
  const { data, error } = await client.from('issb_interview_attempts').select('id,booking_id,status,reason,created_at,ended_at')
    .eq('user_id', userId).eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('AI interview storage is unavailable. Run supabase/issb-ai-interviews.sql in Supabase SQL Editor.');
  if (!data) return null;
  const attempt = { id: data.id, bookingId: data.booking_id, status: data.status, reason: data.reason, endedAt: data.ended_at };
  if (['active','connecting'].includes(attempt.status)) return finishAiAttempt(client, userId, attempt, 'failed', 'page_left');
  return attempt;
}
export function newAiAttempt(bookingId) { return { id: createUUID(), bookingId, status: 'connecting', pending: false }; }

export async function playSpeakerTest() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('Audio playback is not supported in this browser. Use a current desktop browser.');
  const context = new AudioContext();
  try {
    await context.resume();
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.frequency.value = 523.25;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    oscillator.start(); oscillator.stop(context.currentTime + 0.55);
    await new Promise(resolve => { oscillator.onended = resolve; });
  } finally { await context.close(); }
}

// Only audio tracks are sent. Video remains a local preview.
export function createVoiceConnection({ stream, audio, client, attempt, onEvent, onDisconnect }) {
  const peer = new RTCPeerConnection();
  const channel = peer.createDataChannel('oai-events');
  let closed = false, timer, openResolve, openReject;
  const opened = new Promise((resolve, reject) => { openResolve = resolve; openReject = reject; });
  // Register immediately so cancellation before connect() is awaited is safe.
  opened.catch(() => {});
  stream.getAudioTracks().forEach(track => peer.addTrack(track, stream));
  peer.ontrack = event => {
    if (closed) return;
    audio.srcObject = event.streams[0];
    audio.play().catch(() => onDisconnect('speaker_blocked'));
  };
  peer.onconnectionstatechange = () => {
    if (!closed && ['failed','disconnected','closed'].includes(peer.connectionState)) onDisconnect('connection_lost');
  };
  channel.onopen = () => openResolve();
  channel.onclose = () => { if (!closed) { openReject(new Error('AI connection closed.')); onDisconnect('connection_lost'); } };
  channel.onmessage = event => { if (!closed) { try { onEvent(JSON.parse(event.data)); } catch { /* Ignore malformed remote messages. */ } } };
  function close() {
    if (closed) return;
    closed = true; clearTimeout(timer); openReject(new Error('Interview connection cancelled.'));
    peer.ontrack = null; peer.onconnectionstatechange = null;
    channel.onclose = null; channel.onmessage = null; channel.onopen = null;
    channel.close(); peer.close(); audio.pause(); audio.srcObject = null;
  }
  return {
    close,
    async connect() {
      timer = setTimeout(() => openReject(new Error('The AI connection timed out. Please try again later.')), 35000);
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        if (closed) throw new Error('Interview connection cancelled.');
        const data = await interviewRequest(client, { action: 'connect', bookingId: attempt.bookingId, attemptId: attempt.id, sdp: offer.sdp });
        if (closed) throw new Error('Interview connection cancelled.');
        if (!data?.sdp) throw new Error('The AI service returned an invalid connection.');
        await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await opened;
        if (closed) throw new Error('Interview connection cancelled.');
        clearTimeout(timer);
      } catch (error) { close(); throw error; }
    },
    greet() { if (!closed && channel.readyState === 'open') channel.send(JSON.stringify({ type: 'response.create', response: { instructions: 'Introduce yourself as the CadetPrep AI interviewer and ask the cadet for a short spoken introduction. Ask one question and wait.' } })); },
  };
}
