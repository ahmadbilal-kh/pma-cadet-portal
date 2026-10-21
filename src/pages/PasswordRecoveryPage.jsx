import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { requestPasswordReset, updatePassword, verifyRecoveryCode } from '../lib/passwordRecovery';
import { normalizeEmail } from '../lib/registration';

function PasswordField({ label, value, onChange }) {
  const [visible, setVisible] = useState(false);
  return <label className="field-label">{label}<div className="input-wrap"><LockKeyhole size={19} />
    <input type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={value} onChange={event => onChange(event.target.value)} />
    <button type="button" className="input-icon-btn" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{visible ? <Eye size={19} /> : <EyeOff size={19} />}</button>
  </div></label>;
}

export default function PasswordRecoveryPage() {
  const { user, loading, configured, completePasswordRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState(user?.email || '');
  const [sentEmail, setSentEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [reauthenticate, setReauthenticate] = useState(false);
  const needsVerification = !user || reauthenticate;

  useEffect(() => {
    if (!resendIn) return;
    const timeout = setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [resendIn]);

  async function finishSignOut() {
    setBusy(true); setError('');
    try {
      await signOut();
      completePasswordRecovery();
      navigate('/login', { replace: true, state: { passwordUpdated: true } });
    } catch { setError('Your password was updated, but sign out failed. Please try again.'); }
    finally { setBusy(false); }
  }

  async function sendCode(event) {
    event.preventDefault();
    if (busy || resendIn) return;
    setError('');
    if (!configured || !supabase) { setError('Account access is currently unavailable. Please try again later.'); return; }
    setBusy(true);
    try {
      const email = normalizeEmail(sentEmail || verificationEmail);
      await requestPasswordReset(supabase, email, window.location.origin);
      setSentEmail(email); setCode(''); setResendIn(60);
    } catch (err) { setError(err?.message || 'Unable to send a code. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!configured || !supabase) { setError('Account access is currently unavailable. Please try again later.'); return; }
    setBusy(true);
    try {
      await verifyRecoveryCode(supabase, sentEmail, code);
      setCode('');
      setReauthenticate(false);
    } catch (err) { setError(err?.message || 'Unable to verify your account. Please try again.'); }
    finally { setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!configured || !supabase) { setError('Password recovery is currently unavailable. Please try again later.'); return; }
    if (needsVerification) { setError('Please verify your account before changing your password.'); return; }
    setBusy(true);
    try {
      await updatePassword(supabase, password, confirmation);
      setPassword(''); setConfirmation('');
      setDone(true);
      await finishSignOut();
    } catch (err) {
      const message = err?.message || 'Something went wrong. Please try again.';
      setError(message);
      if (/session is missing|session.*expired|log in again/i.test(message)) {
        setReauthenticate(true); setPassword(''); setConfirmation(''); setSentEmail(''); setCode(''); setResendIn(0);
      }
    }
    finally { setBusy(false); }
  }

  if (loading) return <div className="center-loading"><span className="spinner" />Checking your reset link…</div>;

  return <main className="auth-layout">
    <section className="auth-aside"><div className="auth-aside-inner"><Brand inverse />
      <div className="auth-aside-main"><span className="auth-aside-kicker">YOUR NEXT STEP STARTS HERE</span><h2>Back on track.<br />Ready to grow.</h2><p>Recover access to your account and get back to preparing for your next challenge.</p></div>
      <div className="auth-aside-bottom"><ShieldCheck size={17} /> SECURE ACCOUNT RECOVERY</div>
    </div></section>
    <section className="auth-main">
      <div className="auth-main-top"><Link className="back-link" to="/" onClick={completePasswordRecovery}><ArrowLeft size={17} />Back to home</Link></div>
      <div className="auth-form-wrap">
        <div className="auth-number">ACCOUNT RECOVERY</div>
        <h1>{done ? 'Password updated.' : needsVerification ? (sentEmail ? 'Check your email.' : 'Forgot your password?') : 'Set a new password.'}</h1>
        {done ? <>
          <div className="alert alert-success" role="status"><CheckCircle2 size={18} /><span>Your password has been updated. Returning to login…</span></div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {error && <button type="button" className="btn btn-dark auth-submit" disabled={busy} onClick={finishSignOut}>Continue to login<ArrowRight size={18} /></button>}
        </> : needsVerification ? <>
          <p className="auth-subtitle">{sentEmail ? `If an account exists for ${sentEmail}, a verification email has been sent. Enter its code below.` : 'Enter your registered email address to receive a password reset code.'}</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {sentEmail ? <>
          <form className="auth-form" onSubmit={verify}>
            <label className="field-label">Verification code<div className="input-wrap"><ShieldCheck size={19} /><input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter your code" required pattern="[0-9]{6,8}" minLength={6} maxLength={8} value={code} onChange={event => setCode(event.target.value)} /></div></label>
            <button type="submit" className="btn btn-dark auth-submit" disabled={busy}>{busy ? 'Please wait…' : 'Verify code'}<ArrowRight size={18} /></button>
          </form>
          <div className="auth-switch"><button type="button" className="btn btn-ghost" disabled={busy || resendIn > 0} onClick={sendCode}>{resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setSentEmail(''); setCode(''); setError(''); }}>Use a different email</button></div>
          </> : <form className="auth-form" onSubmit={sendCode}>
            <label className="field-label">Email address<div className="input-wrap"><Mail size={19} /><input type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} value={verificationEmail} onChange={event => setVerificationEmail(event.target.value)} /></div></label>
            <button type="submit" className="btn btn-dark auth-submit" disabled={busy || resendIn > 0}>{busy ? 'Please wait…' : resendIn > 0 ? `Send code in ${resendIn}s` : 'Send verification code'}<ArrowRight size={18} /></button>
          </form>}
          <p className="auth-switch"><Link to="/login" onClick={completePasswordRecovery}>Back to login</Link></p>
        </> : <>
          <p className="auth-subtitle">Choose a new password with at least 8 characters.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form className="auth-form" onSubmit={submit}>
            <PasswordField label="New password" value={password} onChange={setPassword} />
            <PasswordField label="Confirm new password" value={confirmation} onChange={setConfirmation} />
            <button type="submit" className="btn btn-dark auth-submit" disabled={busy}>{busy ? 'Please wait…' : 'Update password'}<ArrowRight size={18} /></button>
          </form>
        </>}
      </div>
      <div className="auth-copyright">CadetPrep · Your personal preparation space</div>
    </section>
  </main>;
}
