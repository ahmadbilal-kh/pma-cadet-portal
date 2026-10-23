import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Expand, Mic, Radio, ShieldCheck, Volume2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cacheBooking, loadBooking } from '../lib/issb';
import { createVoiceConnection, finishAiAttempt, forgetAttempt, interviewRequest, latestAiAttempt, MAX_INTERVIEW_MS, mediaError, newAiAttempt, playSpeakerTest, rememberAttempt, rememberedAttempt } from '../lib/aiInterview';
import './aiInterview.css';

export default function AiInterviewPage() {
  const { user } = useAuth();
  const [booking, setBooking] = useState(null), [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('setup'), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [devicesReady, setDevicesReady] = useState(false), [speakerPlayed, setSpeakerPlayed] = useState(false), [speakerReady, setSpeakerReady] = useState(false);
  const [result, setResult] = useState(null), [saveError, setSaveError] = useState(''), [caption, setCaption] = useState('Your interviewer will speak when you join.');
  const [speaking, setSpeaking] = useState(false), [seconds, setSeconds] = useState(0);
  const room = useRef(null), video = useRef(null), audio = useRef(null), stream = useRef(null), transport = useRef(null);
  const phaseRef = useRef('setup'), attempt = useRef(null), mounted = useRef(true), joining = useRef(false), endRef = useRef(null), startedAt = useRef(null);
  function setStage(value) { phaseRef.current = value; if (mounted.current) setPhase(value); }
  function releaseDevices() {
    transport.current?.close(); transport.current = null;
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop(); }); stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (mounted.current) setDevicesReady(false);
  }
  async function leaveFullscreen() {
    if (document.fullscreenElement === room.current) { try { await document.exitFullscreen(); } catch { /* Browser already exited. */ } }
  }
  async function saveResult(outcome, reason) {
    try {
      const saved = await finishAiAttempt(supabase, user.id, attempt.current, outcome, reason);
      attempt.current = saved;
      if (mounted.current) { setResult(saved); setSaveError(''); }
      return saved;
    } catch {
      if (mounted.current) setSaveError('Your result is saved on this device. Reconnect and retry account saving.');
      return null;
    }
  }
  async function end(outcome, reason) {
    if (!['active','connecting'].includes(phaseRef.current) || !attempt.current) return;
    // Disarm before programmatically exiting fullscreen so completion cannot become failure.
    setStage('finished');
    const pending = { ...attempt.current, status: outcome, reason, endedAt: new Date().toISOString(), pending: true };
    attempt.current = pending;
    try { rememberAttempt(user.id, pending); } catch { /* Still attempt the server write. */ }
    if (mounted.current) setResult(pending);
    releaseDevices(); void leaveFullscreen();
    if (booking) { try { cacheBooking(user.id, { ...booking, status: outcome === 'completed' ? 'completed' : 'scheduled' }); } catch { /* Account write follows. */ } }
    await saveResult(outcome, reason);
  }
  endRef.current = end;
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadBooking(supabase, user.id);
        if (cancelled) return;
        setBooking(saved);
        if (!saved) return;
        const previous = await latestAiAttempt(supabase, user.id, saved.id);
        if (cancelled) return;
        if (previous) { attempt.current = previous; setResult(previous); setStage('finished'); }
      } catch (error) {
        if (!cancelled) {
          const pending = rememberedAttempt(user.id);
          if (pending) { attempt.current = pending; setResult(pending); setStage('finished'); setSaveError('Reconnect and retry saving your interview result.'); }
          else setError(error.message);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    const fullscreen = () => { if (document.fullscreenElement !== room.current) void endRef.current?.('failed', 'fullscreen_exit'); };
    const visibility = () => { if (document.hidden) void endRef.current?.('failed', 'page_left'); };
    const leaving = () => { void endRef.current?.('failed', 'page_left'); };
    const beforeUnload = event => {
      if (['active','connecting'].includes(phaseRef.current)) { leaving(); event.preventDefault(); event.returnValue = ''; }
    };
    document.addEventListener('fullscreenchange', fullscreen);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leaving); window.addEventListener('beforeunload', beforeUnload);
    return () => {
      cancelled = true; mounted.current = false;
      document.removeEventListener('fullscreenchange', fullscreen); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leaving); window.removeEventListener('beforeunload', beforeUnload);
      if (['active','connecting'].includes(phaseRef.current) && attempt.current) {
        const pending = { ...attempt.current, status: 'failed', reason: 'page_left', endedAt: new Date().toISOString(), pending: true };
        phaseRef.current = 'finished'; attempt.current = pending;
        try { rememberAttempt(user.id, pending); } catch { /* Best-effort account write below. */ }
        void finishAiAttempt(supabase, user.id, pending, 'failed', 'page_left').catch(() => {});
      }
      releaseDevices(); void leaveFullscreen();
    };
  }, [user.id]);
  useEffect(() => {
    if (phase !== 'active') return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setSeconds(Math.floor(elapsed / 1000));
      if (elapsed >= MAX_INTERVIEW_MS) void endRef.current?.('completed', 'time_complete');
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);
  async function prepareDevices() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error('Use a current desktop browser on HTTPS or localhost for camera and microphone access.');
      if (!room.current?.requestFullscreen || !document.fullscreenEnabled) throw new Error('Fullscreen interviews need a desktop browser with fullscreen support.');
      releaseDevices();
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      if (!media.getAudioTracks().length || !media.getVideoTracks().length) { media.getTracks().forEach(track => track.stop()); throw new Error('Both a camera and a microphone are required.'); }
      stream.current = media;
      media.getTracks().forEach(track => { track.onended = () => {
        if (['active','connecting'].includes(phaseRef.current)) void endRef.current?.('interrupted', 'device_disconnected');
        else { releaseDevices(); setError('A camera or microphone disconnected. Reconnect your devices.'); }
      }; });
      if (video.current) video.current.srcObject = media;
      setDevicesReady(true);
      await interviewRequest(supabase, { action: 'check' });
    } catch (error) { if (mounted.current) setError(mediaError(error)); } finally { if (mounted.current) setBusy(false); }
  }
  async function speakerTest() {
    setError('');
    try { await playSpeakerTest(); if (mounted.current) setSpeakerPlayed(true); } catch (error) { if (mounted.current) setError(mediaError(error)); }
  }
  async function join() {
    if (joining.current || !devicesReady || !speakerReady || !stream.current || !booking) return;
    joining.current = true; setError(''); setBusy(true);
    try {
      // requestFullscreen must be the first asynchronous operation from this click.
      await room.current.requestFullscreen();
      if (document.fullscreenElement !== room.current) throw new Error('Allow fullscreen to join the interview.');
      await interviewRequest(supabase, { action: 'check' });
      if (document.fullscreenElement !== room.current) throw new Error('Stay in fullscreen to join the interview.');
      attempt.current = newAiAttempt(booking.id);
      try { rememberAttempt(user.id, attempt.current); } catch { /* The server also records the attempt. */ }
      setStage('connecting');
      transport.current = createVoiceConnection({ stream: stream.current, audio: audio.current, client: supabase, attempt: attempt.current,
        onDisconnect: reason => void endRef.current?.('interrupted', reason),
        onEvent: event => {
          if (phaseRef.current !== 'active') return;
          if (event.type === 'response.created') { setSpeaking(true); setCaption(''); }
          if (event.type === 'response.output_audio_transcript.delta') setCaption(text => (text + (event.delta || '')).slice(-3000));
          if (event.type === 'response.done') setSpeaking(false);
          if (event.type === 'error') void endRef.current?.('interrupted', 'ai_error');
        },
      });
      await transport.current.connect();
      if (phaseRef.current !== 'connecting') {
        // Finish can race an in-flight provider connection; flush the terminal result again.
        await saveResult(attempt.current.status, attempt.current.reason);
        return;
      }
      setStage('active'); startedAt.current = Date.now(); setSeconds(0);
      transport.current.greet();
    } catch (error) {
      if (error.attemptCreated === false && phaseRef.current === 'connecting') {
        forgetAttempt(user.id); attempt.current = null; setStage('setup'); releaseDevices(); await leaveFullscreen();
      } else if (phaseRef.current === 'connecting') await end('interrupted', 'connection_failed');
      else if (phaseRef.current === 'finished' && attempt.current) await saveResult(attempt.current.status, attempt.current.reason);
      if (mounted.current) setError(mediaError(error));
      if (phaseRef.current === 'setup') await leaveFullscreen();
    } finally { joining.current = false; if (mounted.current) setBusy(false); }
  }
  function retryLater() { attempt.current = null; setResult(null); setSaveError(''); setError(''); setSpeakerPlayed(false); setSpeakerReady(false); setStage('setup'); }
  const failed = result?.status === 'failed';
  return <main className="ai-room" ref={room}>
    <audio ref={audio} autoPlay />
    <header className="ai-room-header"><Link to="/issb" className="ai-back"><ArrowLeft size={17} />Back to preparation</Link><span><ShieldCheck size={17} />CADETPREP · AI INTERVIEW</span><span className="ai-live-status"><i />{phase === 'active' ? 'Live interview' : phase === 'connecting' ? 'Connecting' : 'Interview room'}</span></header>
    {loading ? <section className="ai-room-message"><span className="spinner" /><p>Preparing your interview room...</p></section> : !booking ? <section className="ai-room-message"><h1>Book your interview first.</h1><Link className="btn btn-dark" to="/issb">Choose your interview time</Link></section> : phase === 'finished' && result ? <section className={`ai-result ${failed ? 'ai-result-failed' : ''}`}>
      {failed ? <XCircle size={54} /> : <CheckCircle2 size={54} />}<span className="overline">ISSB MOCK INTERVIEW</span>
      <h1>{failed ? 'Interview not passed.' : result.status === 'completed' ? 'Interview completed.' : 'Interview interrupted.'}</h1>
      <p>{failed ? 'Your interview ended because you left fullscreen or the interview page. Try again later.' : result.status === 'completed' ? 'Thank you for practising. Keep building clear, confident spoken answers.' : 'A device or connection problem ended this attempt. Check your setup and try again later.'}</p>
      {error && <p className="ai-error" role="alert">{error}</p>}
      {saveError && <div className="ai-error" role="alert">{saveError}<button className="btn" onClick={()=>saveResult(result.status,result.reason)}>Retry saving result</button></div>}
      <div className="ai-result-actions"><Link className="btn btn-dark" to="/dashboard">Back to home</Link>{result.status !== 'completed' && !result.pending && !saveError && <button className="btn" onClick={retryLater}>Try again later</button>}</div>
      <small>This is a practice outcome, not an official ISSB selection decision.</small>
    </section> : <div className="ai-room-grid">
      <section className="ai-main-panel">
        <span className="overline">{phase === 'setup' ? 'YOUR NEXT CHALLENGE' : 'LIVE VOICE CONVERSATION'}</span>
        <h1>{phase === 'setup' ? 'Meet your AI interviewer.' : phase === 'connecting' ? 'Connecting your interviewer...' : 'Speak naturally. Be yourself.'}</h1>
        <p>{phase === 'setup' ? 'A real conversation, one question at a time. Prepare your devices, then join in fullscreen.' : 'Listen to the interviewer and answer aloud. You can ask a question to be repeated.'}</p>
        <div className={`ai-orb-stage ${speaking ? 'is-speaking' : ''}`}><div className="ai-orb"><Radio size={52} /></div><span>{phase === 'setup' ? 'AI voice interviewer' : phase === 'connecting' ? 'Establishing a secure voice connection' : speaking ? 'Your interviewer is speaking' : 'Listening to you'}</span><div className="ai-wave" aria-hidden="true">{Array.from({length:19},(_,i)=><i key={i} style={{'--bar':`${12+(i*17)%35}px`,'--delay':`${i*.06}s`}} />)}</div></div>
        {phase === 'setup' ? <>
          <div className="ai-device-steps">
            <div><span className="ai-step-icon"><Camera size={20} /></span><div><strong>Camera & microphone</strong><small>{devicesReady ? 'Devices connected. Check your preview.' : 'Allow access when your browser asks.'}</small></div><button className="ai-control" disabled={busy} onClick={prepareDevices}>{devicesReady ? 'Check again' : 'Allow devices'}</button></div>
            <div><span className="ai-step-icon"><Volume2 size={20} /></span><div><strong>Speaker check</strong><small>Turn up the volume and listen for the tone.</small></div><button className="ai-control" disabled={busy} onClick={speakerTest}>Play test sound</button></div>
          </div>
          {speakerPlayed && <label className="ai-speaker-confirm"><input type="checkbox" checked={speakerReady} onChange={event=>setSpeakerReady(event.target.checked)} />I heard the test sound.</label>}
          <p className="ai-rule"><Expand size={18} />Stay in fullscreen throughout the interview. Leaving fullscreen or this page ends the attempt as not passed.</p>
          <p className="ai-privacy">Your microphone audio is sent to OpenAI for AI responses. Your camera is shown only on this device. CadetPrep does not save audio, video, or conversation transcripts. The voice you hear is AI-generated.</p>
          {!booking.synced && <p className="ai-error">Save this booking to your account before joining.</p>}
          {error && <p className="ai-error" role="alert">{error}</p>}
          <button className="ai-join" disabled={busy || !devicesReady || !speakerReady || !booking.synced} onClick={join}><Expand size={19} />Join fullscreen interview<ArrowRight size={18} /></button>
        </> : <>
          <div className="ai-captions" aria-label="Interviewer captions">{caption || (speaking ? 'Your interviewer is speaking...' : 'Answer aloud when you are ready.')}</div>
          {phase === 'active' && <div className="ai-session-controls"><span><Mic size={17} />Microphone live</span><time>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')} / 10:00</time><button className="ai-control" onClick={()=>end('completed','cadet_finished')}>Finish interview</button></div>}
          <p className="ai-rule"><Expand size={18} />Leaving fullscreen ends this attempt as not passed.</p>
        </>}
      </section>
      <aside className="ai-camera-panel"><div className="ai-preview"><video ref={video} autoPlay muted playsInline aria-label="Your camera preview" />{!devicesReady && <div className="ai-camera-placeholder"><Camera size={35} /><span>Your camera preview</span></div>}<span className="ai-preview-label">{booking.fullName} · You</span></div><div className="ai-camera-note"><ShieldCheck size={20} /><div><strong>A space to focus.</strong><p>Find a quiet room, keep your face in view, and speak clearly. Use headphones to reduce echo.</p></div></div></aside>
    </div>}
  </main>;
}
