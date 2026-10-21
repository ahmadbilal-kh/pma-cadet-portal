import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MessageSquare, ShieldCheck } from 'lucide-react';
import CountryFlag from './CountryFlag';
import { countries } from '../lib/issb';
import { internationalPhone, phoneRequest } from '../lib/phoneVerification';
import './phone-verification.css';

export default function PhoneVerification({ client, country, phone, email, purpose, onChange, onVerified, disabled = false }) {
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const version = useRef(0);
  const notify = useRef(onVerified); notify.current = onVerified;
  const identity = `${country}:${phone}:${email.trim().toLowerCase()}:${purpose}`;
  useEffect(() => {
    version.current++;
    setChallenge(null); setCode(''); setVerified(false); setBusy(false); setError(''); setNotice('');
    notify.current(null);
    return () => { version.current++; };
  }, [identity]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (verified && challenge?.expiresAt <= now) { setVerified(false); notify.current(null); setError('Verification expired. Request a new code.'); }
  }, [now, verified, challenge]);
  const resendSeconds = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0;
  async function send() {
    if (busy || disabled) return;
    const current = version.current;
    setError(''); setNotice(''); setBusy(true);
    try {
      const normalized = internationalPhone(country, phone);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter your email address before requesting a code.');
      const data = await phoneRequest(client, { action: 'send', purpose, country, phone: normalized, email: email.trim().toLowerCase() });
      if (!data?.id || !data?.secret || !Number.isFinite(data.expiresAt)) throw new Error('The SMS request could not be confirmed. Try again.');
      if (current !== version.current) return;
      setChallenge({ ...data, phone: normalized, email: email.trim().toLowerCase(), resendAt: Date.now() + 60000 }); setCode(''); setVerified(false); notify.current(null);
      setNotice(`Verification code sent to ${normalized}.`);
    } catch (error) { if (current === version.current) setError(error.message); }
    finally { if (current === version.current) setBusy(false); }
  }
  async function verify() {
    if (busy || disabled) return;
    const current = version.current;
    setError(''); setNotice('');
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your SMS.'); return; }
    setBusy(true);
    try {
      const result = await phoneRequest(client, { action: 'verify', purpose, id: challenge.id, secret: challenge.secret, code, email: challenge.email });
      if (!result?.verified || result.phone !== challenge.phone) throw new Error('The code could not be verified. Try again.');
      if (current !== version.current) return;
      const proof = { ...challenge, verified: true };
      setVerified(true); setCode(''); notify.current(proof); setNotice('Mobile number verified.');
    } catch (error) { if (current === version.current) setError(error.message); }
    finally { if (current === version.current) setBusy(false); }
  }
  return <fieldset className="phone-verification"><legend>Mobile number</legend>
    <div className="phone-entry"><label className="phone-country"><span className="history-visually-hidden">Country and calling code</span><CountryFlag country={country} /><select value={country} onChange={event => onChange({ country: event.target.value, phone })} disabled={busy || disabled}>{countries.map(([code, name, dial]) => <option key={code} value={code}>{name} (+{dial})</option>)}</select></label><label><span className="history-visually-hidden">Mobile number</span><input type="tel" autoComplete="tel-national" placeholder="3001234567" inputMode="numeric" pattern="[0-9]{10}" minLength={10} value={phone} maxLength={10} disabled={busy || disabled} onChange={event => onChange({ country, phone: event.target.value.replace(/\D/g, '').slice(0,10) })} /></label></div>
    <div className="phone-verify-actions">{verified ? <span className="phone-verified"><CheckCircle2 size={17} />Mobile verified</span> : <button className="phone-send" type="button" disabled={busy || disabled || resendSeconds > 0} onClick={send}><MessageSquare size={16} />{busy ? 'Please wait…' : resendSeconds ? `Resend in ${resendSeconds}s` : challenge ? 'Resend SMS code' : 'Send SMS code'}</button>}<small><ShieldCheck size={13} />Exactly 10 digits ? verify by SMS.</small></div>
    {challenge && !verified && <div className="phone-code"><label>SMS verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label><button type="button" className="phone-send" disabled={busy || disabled} onClick={verify}>Verify code<CheckCircle2 size={16} /></button></div>}
    {error && <p className="phone-error" role="alert">{error}</p>}{notice && <p className="phone-notice" role="status">{notice}</p>}
  </fieldset>;
}
