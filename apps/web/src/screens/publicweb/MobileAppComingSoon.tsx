import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Smartphone } from 'lucide-react';
import OceanScene, { OceanWhale } from '../../components/auth/OceanScene';
import '../../components/auth/ocean-auth.css';

export default function MobileAppComingSoon() {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Mobile App Coming Soon | WWMS';
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
    return () => { document.title = previousTitle; };
  }, []);

  return <div className="ocean-auth-shell flex min-h-svh flex-col">
    <OceanScene />
    <header className="ocean-auth-header">
      <Link to="/" className="ocean-auth-brand-link" aria-label="WWMS home">
        <img src="/SLCGicon.png" alt="Sri Lanka Coast Guard" className="ocean-auth-brand-crest" />
        <span className="ocean-auth-brand"><strong>WWMS</strong><span>Whale-Watching &amp;<br />Boat Monitoring System</span></span>
      </Link>
    </header>
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-10 text-center sm:py-14">
      <div className="w-full max-w-sm"><OceanWhale /></div>
      <p className="mb-4 flex items-center justify-center gap-2 text-xs tracking-[.2em] text-cyan-200 uppercase">
        <Smartphone size={16} aria-hidden="true" />WWMS Mobile App
      </p>
      <h1 ref={heading} tabIndex={-1} className="mb-5 text-4xl font-medium tracking-tight text-[#eafbff] outline-none sm:text-6xl">Coming soon</h1>
      <p className="max-w-md text-sm leading-7 text-[#a8c1cf] sm:text-base">
        The WWMS mobile app isn’t available for download yet. Please check back soon.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3">
        <Link to="/" className="ocean-auth-primary"><ArrowLeft size={16} aria-hidden="true" />Back to home</Link>
        <Link to="/auth" className="ocean-auth-link">Open web portal<ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </main>
    <footer className="ocean-auth-footer"><span>Sri Lanka Coast Guard · WWMS</span><span>Stay connected to the ocean.</span></footer>
  </div>;
}
