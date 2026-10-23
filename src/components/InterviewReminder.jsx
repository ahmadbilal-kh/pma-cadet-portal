import { useEffect, useState } from 'react';
import { BellRing, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { interviewState, loadBooking, readBooking, REMINDER_LEAD, INTERVIEW_WINDOW } from '../lib/issb';

export default function InterviewReminder() {
  const { user, session } = useAuth();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    setBooking(null);
    if (!user?.id) return;
    const read = () => { setBooking(readBooking(user.id)); setNow(Date.now()); };
    read();
    if (session?.user?.id === user.id) loadBooking(supabase, user.id).then(saved => { if (active) setBooking(saved); });
    const timer = setInterval(read, 15000);
    window.addEventListener('issb-booking-changed', read);
    window.addEventListener('storage', read);
    window.addEventListener('focus', read);
    return () => { active = false; clearInterval(timer); window.removeEventListener('issb-booking-changed', read); window.removeEventListener('storage', read); window.removeEventListener('focus', read); };
  }, [user?.id, Boolean(session)]);
  const state = interviewState(booking, now);
  // Keep timed test screens free of interruptions; the reminder is available on return.
  if (!user || !booking || location.pathname.startsWith('/issb') || location.pathname.startsWith('/test/') || !['scheduled', 'ready'].includes(state) || now < booking.startsAt - REMINDER_LEAD || now >= booking.startsAt + INTERVIEW_WINDOW) return null;
  return <Link to="/issb" className="issb-reminder-banner" role="status"><BellRing size={23} /><span><strong>{state === 'ready' ? 'Your mock interview is ready' : 'Your mock interview starts soon'}</strong><small>{state === 'ready' ? 'Open your schedule to start your practice.' : 'Your scheduled time is less than 15 minutes away.'}</small></span><ArrowRight size={20} /></Link>;
}
