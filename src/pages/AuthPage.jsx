import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, AlertCircle } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand';
import PhoneVerification from '../components/PhoneVerification';
import { useAuth } from '../context/AuthContext';
import { supabase, createRegistrationClient } from '../lib/supabase';
import { loginAccount, normalizeEmail, registerAccount, validateRegistration } from '../lib/registration';
import { setRegistrationHandoff, takeRegistrationHandoff } from '../lib/registrationHandoff';

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const navigate = useNavigate();
  const location = useLocation();
  const { user, configured, loading } = useAuth();
  const [fullName,setFullName]=useState('');
  const [phone, setPhone] = useState({ country: 'PK', phone: '' });
  const [phoneProof, setPhoneProof] = useState(null);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [showConfirmPassword,setShowConfirmPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(() => {
    if (isSignup) return;
    const credentials = takeRegistrationHandoff();
    if (credentials) { setEmail(credentials.email); setPassword(credentials.password); }
    if (location.state?.registrationNotice || location.state?.passwordUpdated) {
      setNotice(location.state.registrationNotice || 'Password updated successfully. Log in with your new password.');
      navigate(location.pathname, { replace: true, state: { from: location.state.from } });
    }
  }, [isSignup]);

  if (loading) return <div className="center-loading"><span className="spinner"/> Checking your session…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setNotice('');
    if (!configured || !supabase) { setError('Connect a Supabase project using the .env file to activate real accounts. See README.md.'); return; }
    setBusy(true);
    try {
      const cleanEmail = normalizeEmail(email);
      if (isSignup) {
        validateRegistration({ fullName, email: cleanEmail, password, confirmPassword });
        const registrationClient = createRegistrationClient();
        const { confirmationRequired } = await registerAccount(registrationClient, {
          fullName, email: cleanEmail, password, phoneProof, origin: window.location.origin,
        });
        setRegistrationHandoff(cleanEmail, password);
        setPassword(''); setConfirmPassword('');
        navigate('/login', { replace: true, state: {
          from: location.state?.from,
          registrationNotice: confirmationRequired
            ? 'Registration saved. Confirm your email using the link we sent, then log in. Your credentials have been filled in.'
            : 'Account created successfully. Your credentials have been filled in. Click Log in to continue.',
        } });
      } else {
        await loginAccount(supabase, { email: cleanEmail, password });
        const requested = location.state?.from?.pathname;
        const dest = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') && !['/login', '/signup'].includes(requested) ? requested : '/dashboard';
        setPassword('');
        navigate(dest,{replace:true});
      }
    } catch (err) {
      const message = err?.message || 'Something went wrong. Please try again.';
      setError(message.toLowerCase().includes('invalid login') ? 'Invalid email or password. Please try again.' : message);
    } finally { setBusy(false); }
  }

  return <main className="auth-layout">
    <section className="auth-aside"><div className="auth-aside-inner"><Brand inverse/>
      <div className="auth-aside-main"><span className="auth-aside-kicker">CADET PREPARATION PROGRAM</span><h2>A stronger mind.<br />A clearer mission.</h2><p>Every successful journey starts with commitment. Build the discipline and confidence you need for PMA preparation.</p>
        <div className="auth-aside-quote"><span>“</span><blockquote>Great things are done by a series of small things brought together.</blockquote><small>YOUR PREPARATION BEGINS TODAY</small></div>
      </div><div className="auth-aside-bottom"><ShieldCheck size={17}/> SECURE CADET ACCOUNT ACCESS</div>
    </div></section>
    <section className="auth-main"><div className="auth-main-top"><Link to="/" className="back-link"><ArrowLeft size={17}/> Back to home</Link><div className="auth-mobile-brand"><Brand/></div></div>
      <div className="auth-form-wrap"><div className="auth-number">{isSignup?'01 / CREATE ACCOUNT':'02 / WELCOME BACK'}</div>
        <h1>{isSignup?'Begin your journey.':'Welcome back, cadet.'}</h1>
        <p className="auth-subtitle">{isSignup?'Create your account to access your personal preparation dashboard.':'Log in to continue your PMA preparation journey.'}</p>
        {!configured && <div className="alert alert-warning"><AlertCircle size={18}/><span>Authentication setup required. Add your Supabase URL and publishable key to <code>.env</code> before registering.</span></div>}
        {error && <div className="alert alert-error" role="alert"><AlertCircle size={18}/><span>{error}</span></div>}
        {notice && <div className="alert alert-success" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}
        <form onSubmit={handleSubmit} className="auth-form">
          {isSignup && <label className="field-label">Full name<div className="input-wrap"><UserRound size={19}/><input autoComplete="name" type="text" placeholder="Enter your full name" minLength={2} maxLength={80} required value={fullName} onChange={e=>setFullName(e.target.value)}/></div></label>}
          <label className="field-label">Email address<div className="input-wrap"><Mail size={19}/><input autoComplete="username" type="email" placeholder="you@example.com" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div></label>
          {isSignup && <PhoneVerification client={supabase} country={phone.country} phone={phone.phone} email={email} purpose="registration" onChange={setPhone} onVerified={setPhoneProof} />}
          <label className="field-label">Password<div className="input-wrap"><LockKeyhole size={19}/><input type={showPassword?'text':'password'} autoComplete={isSignup?'new-password':'current-password'} placeholder={isSignup?'Create a strong password':'Enter your password'} required minLength={isSignup?8:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="input-icon-btn" onClick={()=>setShowPassword(x=>!x)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<Eye size={19}/>:<EyeOff size={19}/>}</button></div></label>
          {isSignup && <label className="field-label">Confirm password<div className="input-wrap"><LockKeyhole size={19}/><input type={showConfirmPassword?'text':'password'} autoComplete="new-password" placeholder="Enter your password again" required minLength={8} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/><button type="button" className="input-icon-btn" onClick={()=>setShowConfirmPassword(value=>!value)} aria-label={showConfirmPassword?'Hide confirm password':'Show confirm password'} aria-pressed={showConfirmPassword}>{showConfirmPassword?<Eye size={19}/>:<EyeOff size={19}/>}</button></div></label>}
          {isSignup && <p className="password-hint">Use at least 8 characters. Keep your password private.</p>}
          {!isSignup && <Link className="forgot-password-link" to="/reset-password">Forgot password?</Link>}
          <button type="submit" disabled={busy} className="btn btn-dark auth-submit">{busy?'Please wait…':isSignup?'Create my account':'Log in to dashboard'}<ArrowRight size={19}/></button>
        </form>
        <p className="auth-switch">{isSignup?'Already have an account?':'New to CadetPrep?'} <Link to={isSignup?'/login':'/signup'}>{isSignup?'Log in instead':'Create an account'}</Link></p>
        <div className="auth-trust"><ShieldCheck size={16}/> Your password is handled by Supabase Authentication.</div>
      </div><div className="auth-copyright">CadetPrep · Independent PMA preparation platform</div>
    </section>
  </main>;
}
