import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthApiError } from '../../auth/authApi';
import { useAuth } from '../../auth/useAuth';
import { LockKeyhole, Mail } from 'lucide-react';
import AuthPanel from '../../components/auth/AuthPanel';
import AuthField from '../../components/auth/AuthField';
import AuthButton from '../../components/auth/AuthButton';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const pending = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError('');
    setIsSubmitting(true);

    try {
      const session = await login({ email: email.trim(), password });
      const requestedPath = (location.state as { from?: string } | null)?.from;
      if (session.roles.includes('Admin')) {
        navigate(requestedPath?.startsWith('/admin') ? requestedPath : '/admin', { replace: true });
        return;
      }

      if (session.roles.includes('SLTDA')) {
        navigate(requestedPath?.startsWith('/sltda') ? requestedPath : '/sltda', { replace: true });
        return;
      }

      if (session.roles.includes('OPS')) {
        navigate(requestedPath?.startsWith('/ops') ? requestedPath : '/ops', { replace: true });
        return;
      }

      if (session.roles.includes('ShoreCrew')) {
        navigate(requestedPath?.startsWith('/shore') ? requestedPath : '/shore', { replace: true });
        return;
      }

      if (session.roles.includes('Wildlife')) {
        navigate(requestedPath?.startsWith('/wildlife') ? requestedPath : '/wildlife', { replace: true });
        return;
      }

      if (session.roles.includes('ShoreWildlife')) {
        navigate(requestedPath?.startsWith('/shore-wildlife') ? requestedPath : '/shore-wildlife', { replace: true });
        return;
      }

      if (session.roles.includes('Supervisor')) {
        navigate(requestedPath?.startsWith('/supervisor') ? requestedPath : '/supervisor', { replace: true });
        return;
      }

      if (session.roles.includes('HarbourOfficer')) {
        navigate(requestedPath?.startsWith('/harbour-officer') ? requestedPath : '/harbour-officer', { replace: true });
        return;
      }

      if (session.roles.includes('BoatOwner')) {
        navigate(requestedPath?.startsWith('/owner') ? requestedPath : '/owner', { replace: true });
        return;
      }

      if (session.roles.includes('BoatCrew')) {
        navigate(requestedPath?.startsWith('/crew') ? requestedPath : '/crew', { replace: true });
        return;
      }

      if (session.roles.includes('Passenger')) {
        navigate('/passenger', { replace: true });
        return;
      }

      navigate('/access-denied', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof AuthApiError
        ? loginError.message
        : 'Unable to contact the authentication service.');
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  };

  return <AuthPanel titleId="login-title" label="Secure sign in">
    <div className="ocean-auth-step-content">
      <p className="ocean-auth-step-number">Your operations, connected</p>
      <h1 id="login-title" tabIndex={-1} className="ocean-auth-heading">Welcome back.</h1>
      <p className="ocean-auth-description">Your ocean operations, one connection away.</p>
      <form className="ocean-auth-form" onSubmit={handleLogin} aria-busy={isSubmitting}>
        <AuthField id="login-email" name="email" label="Email address" icon={Mail} type="email" autoComplete="username" required maxLength={256}
          value={email} disabled={isSubmitting} placeholder="you@example.com" aria-describedby={error ? 'login-error' : undefined}
          onChange={event => { setEmail(event.target.value); setError(''); }} />
        <AuthField id="login-password" name="password" label="Password" icon={LockKeyhole} type="password" autoComplete="current-password" required maxLength={128}
          value={password} disabled={isSubmitting} aria-describedby={error ? 'login-error' : undefined}
          onChange={event => { setPassword(event.target.value); setError(''); }} />
        <div className="ocean-auth-forgot"><Link to="/forgot-password" className="ocean-auth-link">Forgot password?</Link></div>
        <div id="login-error" role="alert" className="ocean-auth-error">{error || null}</div>
        <AuthButton pending={isSubmitting} pendingLabel="Signing in…">Sign In</AuthButton>
      </form>
      <p className="ocean-auth-account-nav">New to WWMS? <Link to="/signup">Create an account</Link></p>
    </div>
  </AuthPanel>;
};

export default Login;
