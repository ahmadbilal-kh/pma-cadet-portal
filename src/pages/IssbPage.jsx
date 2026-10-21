import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BellRing, CalendarDays, CheckCircle2, Clock3, Mail, Mic, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardSidebar from '../components/DashboardSidebar';
import ProfileLink from '../components/ProfileLink';
import InterviewTimePicker from '../components/InterviewTimePicker';
import InterviewCalendar, { localDateValue } from '../components/InterviewCalendar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { interviewState, loadBooking, saveBooking, updateInterviewStatus } from '../lib/issb';
import './issb.css';

const questions = [
  'Introduce yourself, your family, and your educational background.',
  'Why do you want to join the Pakistan Army, and what does service mean to you?',
  'Describe a time you took responsibility for a difficult decision.',
  'How would you handle disagreement within a team you are leading?',
  'What are your strengths, and which personal habit are you working to improve?',
  'Discuss a current issue affecting Pakistan and explain your own view.',
];
const dateLabel = booking => new Intl.DateTimeFormat('en-PK', { dateStyle: 'full', timeStyle: 'short', timeZone: booking.timezone }).format(new Date(booking.startsAt));
export default function IssbPage() {
  const { user, avatarUrl } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [question, setQuestion] = useState(0);
  const [notes, setNotes] = useState({});
  const [fields, setFields] = useState(() => ({ fullName: user?.user_metadata?.full_name || '', email: user?.email || '', date: localDateValue(), time: '10:00' }));
  const state = interviewState(booking, now);
  useEffect(() => {
    let active = true;
    loadBooking(supabase,user.id).then(saved => {
      if (active) { setBooking(saved); setLoading(false); }
    }).catch(() => { if (active) { setError('Unable to load your interview schedule. Please try again.'); setLoading(false); } });
    const timer = setInterval(() => setNow(Date.now()),1000);
    return () => { active=false; clearInterval(timer); };
  },[user.id]);
  async function submit(event) {
    event.preventDefault(); setError(''); setNotice('');
    setBusy(true);
    try {
      const saved = await saveBooking(supabase,user,fields);
      setBooking(saved); setEditing(false); setQuestion(0); setNotes({});
      setNotice('Your mock interview is scheduled. We will remind you here when it is nearly time.');
    } catch(error) { setError(error.message); } finally { setBusy(false); }
  }
  async function changeStatus(status) {
    setBusy(true); setError('');
    try { setBooking(await updateInterviewStatus(supabase,user.id,booking,status)); setNotice(''); }
    catch(error) { setError(error.message); } finally { setBusy(false); }
  }
  function reschedule() {
    const date=new Date(booking.startsAt);
    setFields({fullName:booking.fullName,email:user.email,date:localDateValue(date),time:`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`});
    setEditing(true); setError(''); setNotice('');
  }
  return <div className="dashboard-layout dashboard-v2"><DashboardSidebar /><div className="dashboard-body">
    <header className="dashboard-topbar profile-topbar"><Link to="/dashboard" className="back-link"><ArrowLeft size={16} />Back to home</Link><div className="topbar-account"><ProfileLink user={user} avatarUrl={avatarUrl} /></div></header>
    <main className="dashboard-content issb-content">
      <section className="issb-hero"><span className="issb-hero-icon"><Mic size={30} /></span><span className="overline">PREPARE WITH CONFIDENCE</span><h1>Your ISSB preparation starts here.</h1><p>Choose your interview time and practise at your own pace. Every cadet is welcome to prepare.</p><span className="issb-practice"><ShieldCheck size={15} />Independent mock interview | Not an official ISSB appointment</span></section>
      {error && <p className="alert alert-error" role="alert">{error}</p>}{notice && <p className="issb-success" role="status">{notice}</p>}
      {loading ? <section className="history-card history-empty"><span className="spinner" /><p role="status">Loading your interview schedule...</p></section> : <>
        <div className="issb-grid"><section className="history-card issb-booking" aria-labelledby="issb-booking-title">
          <div className="issb-card-title"><span className="history-stat-icon"><CalendarDays size={22} /></span><div><span className="overline">ISSB MOCK INTERVIEW</span><h2 id="issb-booking-title">{!booking || editing ? 'Book your interview' : 'Your interview schedule'}</h2></div></div>
          {!booking || editing ? <form onSubmit={submit} className="issb-form">
            <label>Full name<input name="fullName" autoComplete="name" value={fields.fullName} onChange={event => setFields(previous=>({...previous,fullName:event.target.value}))} minLength={2} maxLength={80} required /></label>
            <div><label htmlFor="issb-email">Email address</label><input id="issb-email" name="email" type="email" autoComplete="email" value={fields.email} readOnly /><small>Reminders go to the email linked to your cadet account.</small></div>
            <InterviewCalendar value={fields.date} onChange={date=>setFields(previous=>({...previous,date}))} />
            <InterviewTimePicker value={fields.time} onChange={time=>setFields(previous=>({...previous,time}))} />
            {new Date(`${fields.date}T${fields.time}`).getTime()<=now && <small className="issb-time-warning">This time has already passed. Choose a later time or another date.</small>}
            <p className="issb-hint"><Clock3 size={16} />Times use your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}. Start during the hour after your selected time.</p>
            <p className="issb-hint"><BellRing size={16} />In-app and email reminders are requested for 15 minutes before your interview.</p>
            <div className="issb-actions">{editing && <button className="btn" type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>}<button className="btn btn-dark" type="submit" disabled={busy}>{busy ? 'Saving schedule...' : editing ? 'Save new schedule' : 'Schedule interview'}<ArrowRight size={17} /></button></div>
          </form> : <>
            <div className="issb-appointment"><span className={`issb-badge ${state==='expired' ? 'expired' : ''}`}>{state==='completed' ? 'Practice completed' : state==='expired' ? 'Time slot ended' : state==='scheduled' ? 'Scheduled' : 'Your interview is ready'}</span><h3>{booking.fullName}</h3><p><CalendarDays size={18} />{dateLabel(booking)}</p><small>{booking.timezone}</small><p><Mail size={18} />{booking.email}</p></div>
            {!booking.synced && <p className="issb-save-warning" role="status">Saved on this browser. Email reminders are unavailable until your booking is saved to your account.</p>}
            {booking.synced && <p className="issb-hint"><BellRing size={17} />{booking.emailSentAt ? 'Email reminder sent.' : 'Email reminder requested; not sent yet.'}</p>}
            {state==='scheduled' && <p className="issb-hint" role="status">The start button unlocks at your selected time.</p>}
            {state==='expired' && <p className="issb-hint">Choose another date and time to try again.</p>}
            {state==='completed' && <p className="issb-success">Well done. Keep practising clear, honest, and confident answers.</p>}
            {state!=='started' && <div className="issb-actions"><button className="btn" type="button" onClick={reschedule}>Reschedule / sync</button>{!['expired','completed'].includes(state) && <button className="btn btn-dark" disabled={state!=='ready' || busy} onClick={()=>changeStatus('started')}>Start interview<ArrowRight size={17} /></button>}</div>}
            {state==='started' && <section className="issb-session" aria-labelledby="interview-question"><span className="overline">PRACTICE QUESTION {question+1} OF {questions.length}</span><h3 id="interview-question" tabIndex={-1}>{questions[question]}</h3><p>Answer aloud and use this space for your notes. Audio is not recorded.</p><label>Your practice notes<textarea value={notes[question] || ''} onChange={event=>setNotes(previous=>({...previous,[question]:event.target.value}))} rows={5} maxLength={4000} /></label><small>Notes clear when you leave this page.</small><div className="issb-actions"><button className="btn" disabled={!question} onClick={()=>setQuestion(value=>value-1)}>Previous</button>{question<questions.length-1 ? <button className="btn btn-dark" onClick={()=>{setQuestion(value=>value+1);document.getElementById('interview-question')?.focus();}}>Next question<ArrowRight size={17} /></button> : <button className="btn btn-dark" disabled={busy} onClick={()=>changeStatus('completed')}>Finish practice<CheckCircle2 size={17} /></button>}</div></section>}
          </>}
        </section><aside className="issb-prep"><section className="history-card"><span className="history-stat-icon"><ShieldCheck size={23} /></span><h2>Arrive with confidence.</h2><ul><li>Find a quiet place and remove distractions.</li><li>Prepare a short, honest introduction.</li><li>Think of examples of teamwork and responsibility.</li><li>Read current affairs and form your own opinions.</li><li>Be ready at your selected time.</li></ul></section><section className="issb-reminder-note"><BellRing size={23} /><h3>A little reminder. A big next step.</h3><p>Open the portal near your interview time for your in-app reminder. Email reminders require account saving and the reminder service.</p></section></aside></div>
      </>}
    </main></div></div>;
}
