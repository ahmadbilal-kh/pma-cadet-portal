import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { categories, TOTAL, createAttempt, transition } from '../exam/engine';
import { makePaper, signature } from '../exam/paper';
import { recordResult } from '../lib/testHistory';

function Figure({ value, label }) {
  // SVG is compiled from the bundled bank/generator; never from user or API input.
  return typeof value === 'string' && value.startsWith('svgraw:')
    ? <span className="exam-figure" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: value.slice(7) }} />
    : <span>{value}</span>;
}
function readState(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved) return null;
    if (saved.status === 'running' || ['interrupt', 'tab'].includes(saved.result?.reason)) {
      localStorage.removeItem(key);
      return null;
    }
    return saved;
  } catch { return null; }
}
export default function ExamPage() {
  const { category } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  if (!categories[category]) return <Navigate to="/dashboard" replace />;
  return <Exam key={`${user.id}:${category}:${location.key}`} category={category} user={user} />;
}
function Exam({ category, user }) {
  const key = `cadetprep:${user.id}:${category}`;
  const [savedResult] = useState(() => readState(key)?.result || null);
  const [attempt, setAttempt] = useState(null);
  const current = useRef(attempt);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  function persist(next) {
    current.current = next;
    setAttempt(next);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { setError('Browser storage is full or unavailable. Your current progress is only kept until this page closes.'); }
  }
  function act(action) {
    const next = transition(current.current, action);
    if (next !== current.current) persist(next);
  }
  function start() {
    setError('');
    try {
      const seen = JSON.parse(localStorage.getItem(`${key}:seen`) || '[]');
      const paper = makePaper(category, seen);
      const next = createAttempt(paper, category);
      // Persist before exposing the exam, so it cannot start without its history.
      localStorage.setItem(`${key}:seen`, JSON.stringify([...new Set([...seen, ...paper.map(signature)])]));
      localStorage.setItem(key, JSON.stringify(next));
      persist(next); setNow(Date.now());
    } catch (e) { setError(e.message || 'Enable browser storage to start a test.'); }
  }
  useEffect(() => {
    if (attempt?.status !== 'running') return;
    const timer = setInterval(() => { setNow(Date.now()); act({ type: 'tick' }); }, 250);
    const leave = () => {
      // Closing or refreshing abandons the paper instead of creating a result.
      if (current.current?.status !== 'running') return;
      current.current = null;
      setAttempt(null);
      setConfirming(false);
      try { localStorage.removeItem(key); } catch { /* Recovery also ignores running papers. */ }
    };
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', leave);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', leave); window.removeEventListener('beforeunload', leave); };
  }, [attempt?.id, attempt?.status]);
  const result = attempt?.result;
  async function syncResult(result) {
    if (!supabase || !result) return;
    try {
      const { error: saveError } = await supabase.from('practice_attempts').upsert({
        id: result.id, user_id: user.id, category, correct: result.correct,
        incorrect: result.incorrect, unanswered: result.unanswered, passed: result.pass,
        reason: result.reason, finished_at: new Date(result.finished).toISOString(), duration_ms: result.duration,
      }, { onConflict: 'id' });
      if (saveError) throw saveError;
    } catch { /* Keep the locally stored result; retry saving when it is reopened. */ }
  }
  useEffect(() => {
    if (savedResult) {
      try { recordResult(user.id, savedResult); } catch { /* Preserve the original per-category result if the archive is full. */ }
      syncResult(savedResult);
    }
  }, [savedResult?.id]);
  useEffect(() => {
    if (!result) return;
    try {
      localStorage.setItem(key, JSON.stringify(current.current));
      recordResult(user.id, result);
    } catch { setError('Your result could not be added to browser history. Browser storage is unavailable or full.'); }
    syncResult(result);
  }, [result?.id]);
  const seconds = Math.max(0, Math.ceil(((attempt?.due || now) - now) / 1000));
  const answered = attempt?.answers?.filter(a => a !== null).length || 0;
  const q = attempt?.status === 'running' ? attempt.paper[attempt.index] : null;
  const choice = q ? attempt.answers[attempt.index] : null;
  const readyToSubmit = q && (answered === TOTAL || (attempt.index === TOTAL - 1 && choice !== null));
  return <div className="exam-shell">
    <header className="exam-header"><Brand to="/dashboard"/>{attempt?.status === 'running' && <button className="btn btn-dark" onClick={() => setConfirming(true)}>Finish test</button>}</header>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {!q && !result && <section className="exam-intro"><span className="overline">FOCUS. PRACTISE. PROGRESS.</span><h1>{categories[category]}</h1><p>A dedicated practice paper to strengthen your preparation.</p><div className="exam-stats"><div><strong>85</strong>questions</div><div><strong>30:00</strong>minutes</div><div><strong>64</strong>correct to pass</div></div><ul><li>Answers lock after selection. Your result is shown only after submission.</li><li>Use Previous, Next, and Skip. A skipped question returns after ten forward moves, or when you reach the end.</li><li>Submit when you finish. A score of at least 64 correct is a pass; unanswered questions are counted separately.</li><li>You may switch tabs or windows while the timer continues. Reloading or leaving this page abandons an unfinished attempt.</li><li>Seen questions are remembered per account in this browser. Fresh generated variants fill the paper when needed.</li></ul><button className="btn btn-dark" onClick={start}>Start 30-minute test →</button><p className="exam-disclaimer">Independent practice; not an official Pakistan Army examination.</p></section>}
    {q && <div className="exam-workspace"><div className="exam-main">
      <section className="exam-toolbar"><div><span className="overline">{categories[category]}</span><h1>Question {attempt.index + 1} <small>/ {TOTAL}</small></h1></div><div className={`exam-clock ${seconds < 300 ? 'urgent' : ''}`} role="timer" aria-label="Time remaining">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</div></section>
      <div className="exam-progress" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={answered}><span style={{ width: `${answered / TOTAL * 100}%` }}/></div>
      <p className="exam-meta">{answered} answered · {TOTAL - answered} remaining · {Object.keys(attempt.skipped).length} queued to revisit</p>
      <section className="exam-question"><span className="overline">{q.category}</span><h2>{q.question}</h2>
        {q.visual && <div className={`exam-visual ${q.visual.mode === 'matrix' ? 'matrix' : ''}`} aria-label="Question figures">{q.visual.figures.map((v, i) => <Figure key={i} value={v} label={`Panel ${i + 1}`}/>)}</div>}
        <div className="exam-options">{q.options.map((opt, i) => <button key={i} disabled={choice !== null} aria-pressed={choice === i} className={`exam-option ${choice === i ? 'selected' : ''}`} onClick={() => act({ type: 'answer', choice: i })}><b>{'ABCD'[i]}</b><Figure value={opt} label={`Option ${'ABCD'[i]}`}/></button>)}</div>
        <div className="exam-actions"><button className="btn" disabled={attempt.index === 0} onClick={() => act({ type: 'previous' })}>← Previous</button>{choice === null && <button className="btn" onClick={() => act({ type: 'skip' })}>Skip for now</button>}<button className="btn btn-dark" disabled={choice === null} onClick={() => readyToSubmit ? setConfirming(true) : act({ type: 'next' })}>{readyToSubmit ? 'Submit test' : 'Next →'}</button></div>
      </section>
      </div><aside className="exam-question-panel" aria-label="Question panel">
        <h2>Questions</h2><p>Choose an unanswered question.</p>
        <nav className="exam-map" aria-label="Question navigation">{attempt.paper.map((_, i) => {
          const done = attempt.answers[i] !== null;
          return <button type="button" key={i} disabled={done} aria-label={`Question ${i + 1}${done ? ', answered' : ''}`} aria-current={i === attempt.index ? 'step' : undefined} className={`${done ? 'done' : ''} ${i === attempt.index ? 'current' : ''}`} onClick={() => act({ type: 'jump', index: i })}>{i + 1}</button>;
        })}</nav>
        <div className="exam-map-legend"><span>Current</span><span>Answered</span></div>
      </aside></div>}
    {result && <section className={`exam-result ${result.pass ? 'passed' : 'not-passed'}`}>
      {result.pass && <div className="exam-confetti" aria-hidden="true">✦ · ✧ · ✦ · ✧ · ✦</div>}
      <span className="overline">{result.pass ? 'MISSION ACCOMPLISHED' : ['tab', 'interrupt'].includes(result.reason) ? 'ATTEMPT ENDED' : 'KEEP TRAINING'}</span>
      <h1 className="exam-result-message">{result.pass ? `Congratulations, ${user.user_metadata?.full_name?.split(' ')[0] || 'Cadet'}! Best of luck ahead.` : 'Best of luck for next time.'}</h1>
      <div className="exam-actions"><Link className="btn btn-dark" to="/">Back to home</Link></div>
    </section>}
    {confirming && q && <div className="exam-overlay"><section className="exam-dialog" role="alertdialog" aria-modal="true" aria-labelledby="finish-title"><h2 id="finish-title">Finish this attempt?</h2><p>{TOTAL - answered} questions remain unanswered. Your result will be calculated immediately.</p><div className="exam-actions"><button autoFocus className="btn" onClick={() => setConfirming(false)}>Keep answering</button><button className="btn btn-dark" onClick={() => { setConfirming(false); act({ type: 'finish', reason: answered === TOTAL ? 'complete' : 'early' }); }}>Submit result</button></div></section></div>}
  </div>;
}
