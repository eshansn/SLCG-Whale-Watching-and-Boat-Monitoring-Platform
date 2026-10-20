import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LayoutDashboard, LogOut, Menu, MessageSquareText, Ship, UsersRound, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../auth/useAuth';
import { useComplaintData } from '../Complaints/useComplaintData';
import './sltda.css';

const destinations = [
  { to: '/sltda', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/sltda/passengers', label: 'Passengers', icon: UsersRound },
  { to: '/sltda/trips', label: 'Trip history', icon: Ship },
  { to: '/sltda/complaints', label: 'Complaints & inquiries', icon: MessageSquareText },
];

export default function SltdaLayout({ children }: { children: ReactNode }) {
  const { logout, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const notices = useComplaintData<{ unread: number }>('/api/complaint-notifications/unread-count', true);
  const closeMenu = () => setMenu(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (account.current) account.current.open = false;
      if (menu) menuButton.current?.focus();
      setMenu(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [menu]);
  const links = destinations.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={closeMenu}
    className={({ isActive }) => `flex min-h-11 items-center gap-2 rounded-lg px-3 text-[13px] font-medium ${isActive || (item.to.endsWith('/trips') && location.pathname.includes('/monitoring-trips/')) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
    <item.icon size={16} strokeWidth={1.8} /><span>{item.label}</span>
  </NavLink>);
  return <div className="sltda-portal">
    <a href="#sltda-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3">Skip to content</a>
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/sltda" onClick={closeMenu} aria-label="SLTDA dashboard" className="flex min-w-0 items-center gap-2.5">
          <img src="/sltda-logo.png" alt="Sri Lanka Tourism Development Authority" className="h-10 w-11 shrink-0 object-contain" />
          <span><strong className="block text-base tracking-tight">SLTDA<span className="ml-1.5 hidden text-[10px] font-medium uppercase tracking-widest text-slate-400 xl:inline">Portal</span></strong><span className="block whitespace-nowrap text-[10px] text-slate-500 max-[400px]:hidden">Tourism development authority</span></span>
        </Link>
        <nav aria-label="SLTDA navigation" className="sltda-navigation hidden items-center gap-1 lg:flex">{links}</nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link to="/sltda/complaint-notifications" onClick={closeMenu} aria-label={notices.data ? `Notifications, ${notices.data.unread} unread` : 'Notifications'} className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Bell size={19} />
            {!!notices.data?.unread && <span className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-semibold text-white">{notices.data.unread > 99 ? '99+' : notices.data.unread}</span>}
          </Link>
          <details ref={account} className="relative"><summary aria-label="Account menu" className="flex min-h-10 list-none items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden"><span className="grid h-8 w-8 place-items-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-semibold text-indigo-700">{session?.email.slice(0, 2).toUpperCase()}</span><ChevronDown size={13} className="hidden text-slate-400 sm:block" /></summary>
            <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg"><div className="border-b border-slate-100 px-3 py-3"><p className="text-xs font-semibold">SLTDA monitoring officer</p><p className="mt-1 truncate text-xs text-slate-500">{session?.email}</p></div><button type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-50"><LogOut size={16} />Log out</button></div>
          </details>
          <button type="button" ref={menuButton} aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-controls="sltda-mobile-navigation" aria-expanded={menu} onClick={() => setMenu(open => !open)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden">{menu ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </div>
      {menu && <nav id="sltda-mobile-navigation" aria-label="SLTDA mobile navigation" className="sltda-navigation grid gap-1 border-t border-slate-100 px-4 py-3 lg:hidden">{links}</nav>}
    </header>
    <motion.div key={location.pathname} id="sltda-content" tabIndex={-1} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .18, ease: 'easeOut' }}>{children}</motion.div>
    <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pb-6 pt-2 text-[10px] text-slate-400 sm:px-6 lg:px-8"><span>Sri Lanka Tourism Development Authority · WWMS</span><span>Authorized monitoring workspace · All times in Sri Lanka</span></footer>
  </div>;
}
