import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { RecoveryApiError, recoveryPost, type RecoveryAccepted, type RecoveryVerified } from '../../auth/passwordRecoveryApi';
import AuthPanel from '../../components/auth/AuthPanel';
import AuthField from '../../components/auth/AuthField';
import AuthButton from '../../components/auth/AuthButton';
import AuthPasswordGuidance from '../../components/auth/AuthPasswordGuidance';
import { passwordRequirements } from '../../components/auth/passwordPolicy';
import RecoveryOtpInput from './recovery/RecoveryOtpInput';


type Stage = 'email' | 'code' | 'password' | 'success';
const errors = {
  invalid: 'The code or authorization is invalid, expired, or no longer available. Check your code or start a new request.',
  limited: 'Too many requests. Please wait before trying again.',
  unavailable: 'Password recovery is temporarily unavailable. Please try again later.',
  network: 'Unable to complete the request. Check your connection and try again.',
  mismatch: 'Passwords do not match.',
  rules: 'Use 12–128 characters, at least 6 different characters, an uppercase letter, a lowercase letter, a number, and a symbol.',
} as const;
const headings: Record<Stage, string> = {
  email: 'Lost in the depths?', code: 'Verify your identity', password: 'Chart a new course', success: "You’re back on course",
};

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return domain ? `${name.slice(0, 1)}${'•'.repeat(Math.min(4, Math.max(2, name.length - 1)))}@${domain}` : '';
}

export default function PasswordRecovery() {
  const { logout } = useAuth();
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [accountHint, setAccountHint] = useState('');
  const [code, setCode] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [authorization, setAuthorization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busyAction, setBusyAction] = useState<'submit' | 'resend' | null>(null);
  const [error, setError] = useState<keyof typeof errors | null>(null);
  const [notice, setNotice] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = busyAction !== null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(timer); request.current?.abort(); };
  }, []);
  useEffect(() => {
    if (stage === 'code') document.getElementById('recovery-code-0')?.focus();
    else heading.current?.focus();
  }, [stage]);

  const reset = () => {
    request.current?.abort();
    setEmail(''); setAccountHint(''); setCode(''); setRecoveryId(''); setAuthorization('');
    setPassword(''); setConfirmation(''); setError(null); setNotice(false);
    setExpiresAt(0); setResendAt(0); setStage('email');
  };

  async function run(action: (signal: AbortSignal) => Promise<void>, kind: 'submit' | 'resend' = 'submit') {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusyAction(kind); setError(null); setNotice(false);
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try { await action(controller.signal); }
    catch (failure) {
      if (failure instanceof RecoveryApiError) setError(failure.status === 429 ? 'limited' : failure.status === 503 ? 'unavailable' : 'invalid');
      else setError('network');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
      setBusyAction(null);
    }
  }

  const accepted = (result: RecoveryAccepted) => {
    setRecoveryId(result.recoveryId); setCode(''); setEmail(''); setAuthorization('');
    setExpiresAt(Date.now() + result.expiresInSeconds * 1000);
    setResendAt(Date.now() + result.resendAfterSeconds * 1000);
    setNow(Date.now()); setStage('code'); setNotice(true);
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage === 'email') void run(async signal => {
      const result = await recoveryPost<RecoveryAccepted>('forgot-password', { email: email.trim() }, signal);
      setAccountHint(maskEmail(email.trim())); accepted(result);
    });
    if (stage === 'code' && /^[0-9]{6}$/.test(code)) void run(async signal => {
      const result = await recoveryPost<RecoveryVerified>('verify-reset-otp', { recoveryId, code }, signal);
      setAuthorization(result.resetAuthorization); setCode('');
      setExpiresAt(Date.now() + result.expiresInSeconds * 1000); setNow(Date.now()); setStage('password');
    });
    if (stage === 'password') {
      if (password !== confirmation) { setError('mismatch'); return; }
      if (passwordRequirements(password).some(requirement => !requirement.met)) { setError('rules'); return; }
      void run(async signal => {
        await recoveryPost('reset-password', { recoveryId, resetAuthorization: authorization, newPassword: password, confirmPassword: confirmation }, signal);
        logout(); setAuthorization(''); setRecoveryId(''); setPassword(''); setConfirmation(''); setCode(''); setAccountHint('');
        setStage('success');
      });
    }
  }

  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const countdown = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  const expired = expiresAt > 0 && now >= expiresAt;
  const step = stage === 'email' ? 1 : stage === 'code' ? 2 : 3;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const submitLabel = stage === 'email' ? 'Send Verification Code' : stage === 'code' ? 'Verify code' : 'Reset password';
  const loadingLabel = stage === 'email' ? 'Sending code…' : stage === 'code' ? 'Verifying…' : 'Updating password…';

  return <AuthPanel titleId="recovery-title" label="Secure account recovery" step={step} complete={stage === 'success'} note="Your account. Your access. Safely restored.">
        <div key={stage} className="ocean-auth-step-content">
          {stage === 'success' ? <div className="ocean-auth-success-mark" aria-hidden="true"><Check size={27} strokeWidth={1.5} /></div>
            : <p className="ocean-auth-step-number">Step 0{step} / 03 · {stage === 'email' ? 'Find your account' : stage === 'code' ? 'Confirm it’s you' : 'A fresh start'}</p>}
          <h1 id="recovery-title" ref={heading} tabIndex={-1} className="ocean-auth-heading">{headings[stage]}</h1>
          {stage === 'email' && <p className="ocean-auth-description">No worries. Enter the email address registered to your WWMS account, and we’ll help you find your way back.</p>}
          {stage === 'code' && <p className="ocean-auth-description">One more step before you return to the ocean. Enter your six-digit verification code.
            {accountHint && <><br /><span className="ocean-auth-account-hint" aria-label="Account email entered">{accountHint}</span></>}
          </p>}
          {stage === 'password' && <><p className="ocean-auth-description">Create a new password to secure your WWMS account.</p><p className="ocean-auth-verified"><Check size={13} aria-hidden="true" />Identity verified</p></>}
          {stage === 'success' ? <>
            <p role="status" className="ocean-auth-description ocean-auth-success-copy">Your password has been updated successfully. You can now sign in to WWMS using your new password.</p>
            <Link className="ocean-auth-primary" to="/login">Return to Sign In<ArrowRight size={15} aria-hidden="true" /></Link>
          </> : <>
            <form onSubmit={submit} className="ocean-auth-form" aria-busy={busy}>
              {stage === 'email' && <AuthField id="recovery-email" name="email" label="Registered email address" icon={Mail} type="email" autoComplete="email" required maxLength={256} placeholder="you@example.com"
                value={email} disabled={busy} onChange={event => setEmail(event.target.value)} aria-describedby={error ? 'recovery-error' : undefined} />}
              {stage === 'code' && <div>
                <RecoveryOtpInput value={code} onChange={setCode} disabled={busy} invalid={error === 'invalid'} />
                <p id="recovery-code-help" className="ocean-auth-code-help">{expired ? 'This code has expired. Request a new code.' : 'Valid for 10 minutes after each request. Never share your code.'}</p>
              </div>}
              {stage === 'password' && <>
                {([['recovery-password', 'New password', password, setPassword], ['recovery-confirmation', 'Confirm new password', confirmation, setConfirmation]] as const).map(([id, label, value, update]) =>
                  <AuthField key={id} id={id} name={id} label={label} icon={LockKeyhole} type="password" autoComplete="new-password" required minLength={12} maxLength={128}
                    value={value} disabled={busy} onChange={event => update(event.target.value)} aria-describedby="recovery-rules recovery-error"
                    error={id === 'recovery-confirmation' && mismatch ? 'Passwords do not match.' : undefined} />)}
                <AuthPasswordGuidance id="recovery-rules" password={password} />
                {expired && <p role="status" className="ocean-auth-error">Your reset authorization has expired. Start a new recovery request.</p>}
              </>}
              <div id="recovery-error" role="alert" className="ocean-auth-error">{error ? errors[error] : null}</div>
              {notice && <p role="status" className="ocean-auth-notice">If the account is eligible, your request was accepted for processing. Check your registered email; delivery may take a few minutes.</p>}
              <AuthButton pending={busyAction === 'submit'} pendingLabel={loadingLabel} disabled={busy || (stage !== 'email' && expired) || (stage === 'code' && !/^[0-9]{6}$/.test(code))}>{submitLabel}</AuthButton>
              {stage === 'code' && <div className="ocean-auth-resend">Didn’t receive your code?<br />
                <button type="button" className="ocean-auth-link" disabled={busy || remaining > 0}
                  onClick={() => void run(async signal => accepted(await recoveryPost<RecoveryAccepted>('resend-reset-otp', { recoveryId }, signal)), 'resend')}>
                  {busyAction === 'resend' ? <><LoaderCircle size={12} className="ocean-auth-spin" aria-hidden="true" />Sending code…</> : remaining > 0 ? `Resend code in ${countdown}` : 'Resend code'}
                </button>
              </div>}
            </form>
            <nav className="ocean-auth-nav" aria-label="Recovery navigation">
              <Link onClick={reset} className="ocean-auth-link" to="/login"><ArrowLeft size={13} aria-hidden="true" />Back to Sign In</Link>
              {stage !== 'email' && <button type="button" onClick={reset} disabled={busy} className="ocean-auth-link">Start a new request</button>}
            </nav>
          </>}
        </div>
  </AuthPanel>;
}
