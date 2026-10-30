import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Anchor, ArrowLeft, ArrowRight, BadgeCheck, ContactRound, LockKeyhole, Mail, Phone, ShipWheel, UserRound } from 'lucide-react';
import { AuthApiError, register } from '../../auth/authApi';
import { useAuth } from '../../auth/useAuth';
import AuthPanel from '../../components/auth/AuthPanel';
import AuthField from '../../components/auth/AuthField';
import AuthButton from '../../components/auth/AuthButton';
import AuthPasswordGuidance from '../../components/auth/AuthPasswordGuidance';
import { certificateAccept, certificateError } from '../BoatCrew/certificateValidation';

type PublicRole = 'BoatOwner' | 'BoatCrew';

export default function SignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ role: '' as PublicRole | '', username: '', fullName: '', nicNumber: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');
  const [certificate, setCertificate] = useState<File>();
  const [uploadError, setUploadError] = useState('');
  const [checkingCertificate, setCheckingCertificate] = useState(false);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.currentTarget;
    setFormData(current => ({ ...current, [name]: value }));
    setError('');
  };

  const selectRole = (role: PublicRole) => { setFormData(current => ({ ...current, role })); setError(''); setStep(2); };

  const handleFinalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || created) return;
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
    if (formData.role !== 'BoatOwner' && formData.role !== 'BoatCrew') { setStep(1); return; }
    pending.current = true; setIsSubmitting(true); setError('');
    let registered = false;
    try {
      if (formData.role === 'BoatCrew') {
        const validation = await certificateError(certificate);
        if (validation) { setUploadError(validation); setStep(2); return; }
      }
      const email = formData.email.trim();
      await register({
        userName: formData.username.trim(), displayName: formData.fullName.trim(), nicNumber: formData.nicNumber.trim(),
        email, phoneNumber: formData.phone.trim(), password: formData.password, role: formData.role,
      }, certificate);
      registered = true; setCreated(true);
      const session = await login({ email, password: formData.password });
      navigate(session.roles.includes('BoatOwner') ? '/owner' : '/crew', { replace: true });
    } catch (failure) {
      setError(registered ? 'Your account was created, but automatic sign-in could not be completed. Please sign in to continue.'
        : failure instanceof AuthApiError ? failure.message : 'Unable to contact the registration service. Please try again.');
    } finally { pending.current = false; setIsSubmitting(false); }
  };

  const roleLabel = formData.role === 'BoatOwner' ? 'Boat Owner' : 'Crew Member';
  const mismatch = formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;

  return <AuthPanel titleId="signup-title" label="Create your WWMS account" step={step} note="Public registration · Boat owners & crew">
    <div key={step} className="ocean-auth-step-content">
      <p className="ocean-auth-step-number">Step 0{step} / 03 · {step === 1 ? 'Your role on the water' : step === 2 ? 'Your account details' : 'Secure your access'}</p>
      <h1 id="signup-title" ref={heading} tabIndex={-1} className="ocean-auth-heading">{step === 1 ? 'Create your account.' : step === 2 ? 'Let’s get acquainted.' : 'Make it securely yours.'}</h1>
      <p className="ocean-auth-description">{step === 1 ? 'Start your journey with WWMS. Choose the role that matches your work on the water.'
        : step === 2 ? `A few details to set up your ${roleLabel.toLowerCase()} account.` : 'Choose a strong password to protect your connection.'}</p>
      {step === 1 && <div className="ocean-auth-role-options" role="group" aria-label="Choose your account type">
        {([{ role: 'BoatOwner', label: 'Boat Owner', description: 'Manage your boats, crew, and journeys.', icon: Anchor },
          { role: 'BoatCrew', label: 'Crew Member', description: 'Stay connected to your work on the water.', icon: ShipWheel }] as const).map(option =>
          <button type="button" key={option.role} className="ocean-auth-role" onClick={() => selectRole(option.role)}>
            <option.icon size={21} className="ocean-auth-role-icon" aria-hidden="true" />
            <span><strong>{option.label}</strong><small>{option.description}</small></span><ArrowRight size={15} aria-hidden="true" />
          </button>)}
      </div>}
      {step === 2 && <form className="ocean-auth-form" onSubmit={async event => {
        event.preventDefault();
        if (checkingCertificate) return;
        setCheckingCertificate(true);
        try {
          const validation = formData.role === 'BoatCrew' ? await certificateError(certificate) : undefined;
          setUploadError(validation ?? '');
          if (!validation) { setError(''); setStep(3); }
        } catch { setUploadError('Unable to read this certificate. Please select the file again.'); }
        finally { setCheckingCertificate(false); }
      }}>
        <div className="ocean-auth-registration-grid">
        <AuthField id="signup-username" label="Username" icon={UserRound} name="username" value={formData.username} onChange={handleChange}
          autoComplete="username" required minLength={3} maxLength={64} pattern={'[a-zA-Z0-9._\\-]+'} title="Use 3–64 letters, numbers, dots, underscores, or hyphens."
          hint="3–64 letters, numbers, dots, underscores, or hyphens." />
        <AuthField id="signup-full-name" label="Full name" icon={ContactRound} name="fullName" value={formData.fullName} onChange={handleChange} autoComplete="name" required maxLength={160} />
        <AuthField id="signup-nic" label="NIC number" icon={BadgeCheck} name="nicNumber" value={formData.nicNumber} onChange={handleChange}
          autoComplete="off" required pattern="([0-9]{9}[vVxX])|([0-9]{12})" title="Enter 9 digits followed by V or X, or a 12-digit NIC number." />
        <AuthField id="signup-phone" label="Phone number" icon={Phone} name="phone" type="tel" value={formData.phone} onChange={handleChange} autoComplete="tel" required maxLength={32} />
        <AuthField id="signup-email" label="Email address" icon={Mail} name="email" type="email" value={formData.email} onChange={handleChange} autoComplete="email" required maxLength={256} containerClassName="ocean-auth-field-wide" />
        {formData.role === 'BoatCrew' && <div className="ocean-auth-field ocean-auth-field-wide">
          <label htmlFor="signup-certificate" className="ocean-auth-label">Crew certificate (required)</label>
          <input id="signup-certificate" name="certificate" type="file" className="ocean-auth-certificate-input" accept={certificateAccept} required={!certificate}
            aria-describedby="signup-certificate-help signup-certificate-error" aria-invalid={!!uploadError}
            onChange={event => { setCertificate(event.target.files?.[0]); setUploadError(''); }} />
          <p id="signup-certificate-help" className="ocean-auth-field-hint">A certificate is required for approval. PDF, JPEG, PNG, or WebP, up to 5 MB.{certificate ? ` Selected: ${certificate.name}` : ''}</p>
          <p id="signup-certificate-error" role="alert" className="ocean-auth-error">{uploadError || null}</p>
        </div>}
        </div>
        <AuthButton pending={checkingCertificate} pendingLabel="Checking certificate…">Continue</AuthButton>
        <button type="button" className="ocean-auth-link" onClick={() => setStep(1)}><ArrowLeft size={13} aria-hidden="true" />Change account type</button>
      </form>}
      {step === 3 && <form className="ocean-auth-form" onSubmit={handleFinalSubmit} aria-busy={isSubmitting}>
        <p className="ocean-auth-selected-role"><BadgeCheck size={13} aria-hidden="true" />{roleLabel} registration</p>
        <AuthField id="signup-password" name="password" label="Password" icon={LockKeyhole} type="password" value={formData.password} onChange={handleChange}
          required minLength={12} maxLength={128} autoComplete="new-password" disabled={isSubmitting || created}
          pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{12,}" title="Use at least 12 characters with uppercase, lowercase, a number, and a symbol."
          aria-describedby="signup-rules signup-error" />
        <AuthField id="signup-confirm-password" name="confirmPassword" label="Confirm password" icon={LockKeyhole} type="password" value={formData.confirmPassword} onChange={handleChange}
          required minLength={12} maxLength={128} autoComplete="new-password" disabled={isSubmitting || created} aria-describedby="signup-error" error={mismatch ? 'Passwords do not match.' : undefined} />
        <AuthPasswordGuidance id="signup-rules" password={formData.password} />
        <div id="signup-error" className="ocean-auth-error" role="alert">{error || null}</div>
        {created && !isSubmitting ? <Link to="/login" className="ocean-auth-primary">Continue to Sign In<ArrowRight size={15} aria-hidden="true" /></Link>
          : <AuthButton pending={isSubmitting} pendingLabel="Creating your account…">Create Account</AuthButton>}
        <button type="button" className="ocean-auth-link" disabled={isSubmitting || created} onClick={() => { setError(''); setStep(2); }}><ArrowLeft size={13} aria-hidden="true" />Back to your details</button>
      </form>}
      <p className="ocean-auth-account-nav">Already have an account? <Link to="/login">Sign In</Link></p>
    </div>
  </AuthPanel>;
}
