import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import AuthPanel from '../../components/auth/AuthPanel';

export default function AuthLanding() {
  return <AuthPanel titleId="auth-welcome-title" label="Welcome to WWMS">
    <div className="ocean-auth-step-content">
      <p className="ocean-auth-step-number">Your passage to the platform</p>
      <h1 id="auth-welcome-title" tabIndex={-1} className="ocean-auth-heading">Connected to the ocean.</h1>
      <p className="ocean-auth-description">Secure access to your whale-watching and boat-monitoring operations, wherever the journey takes you.</p>
      <div className="ocean-auth-entry-actions">
        <Link to="/login" className="ocean-auth-primary">Sign In<ArrowRight size={15} aria-hidden="true" /></Link>
        <Link to="/signup" className="ocean-auth-secondary">Create an account<ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      <nav className="ocean-auth-nav" aria-label="Account access navigation"><Link to="/" className="ocean-auth-link"><ArrowLeft size={13} aria-hidden="true" />Back to home</Link></nav>
    </div>
  </AuthPanel>;
}
