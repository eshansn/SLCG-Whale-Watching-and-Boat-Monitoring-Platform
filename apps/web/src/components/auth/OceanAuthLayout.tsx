import { Link, Outlet } from 'react-router-dom';
import OceanScene, { OceanWhale } from './OceanScene';
import './ocean-auth.css';

export default function OceanAuthLayout() {
  return <main lang="en" className="ocean-auth-shell">
    <OceanScene />
    <header className="ocean-auth-header">
      <Link to="/auth" className="ocean-auth-brand-link" aria-label="WWMS account access">
        <img src="/SLCGicon.png" alt="Sri Lanka Coast Guard" className="ocean-auth-brand-crest" />
        <span className="ocean-auth-brand"><strong>WWMS</strong><span>Whale-Watching &amp;<br />Boat Monitoring System</span></span>
      </Link>
    </header>
    <div className="ocean-auth-content">
      <aside className="ocean-auth-visual" aria-label="WWMS account security">
        <div className="ocean-auth-visual-label">A connection worth protecting</div>
        <OceanWhale />
        <h2>Your connection to<br />the ocean, <em>protected.</em></h2>
        <p>A secure passage back to the people,<br />journeys, and waters that matter.</p>
        <div className="ocean-auth-visual-caption"><span />Sri Lanka Coast Guard · Account security</div>
      </aside>
      <Outlet />
    </div>
    <footer className="ocean-auth-footer"><span>© {new Date().getFullYear()} Sri Lanka Coast Guard · WWMS</span><span>Stay connected to the ocean.</span></footer>
  </main>;
}
