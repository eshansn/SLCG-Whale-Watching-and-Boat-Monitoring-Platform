import { useEffect, useState, type ReactNode } from 'react';
import { Bell, House, Menu, Settings, Ship, UserRound, Waves, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { to: '/crew', label: 'Dashboard', icon: House },
  { to: '/crew/profile', label: 'Profile', icon: UserRound },
  { to: '/crew/trips', label: 'My Trips', icon: Ship },
  { to: '/crew/settings', label: 'Settings', icon: Settings },
];

export function CrewLayout({ children, className = '' }: { children: ReactNode; title?: string; className?: string }) {
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return <main className="min-h-dvh w-full bg-[#f7f9fc] text-[#14223d]">
    <div className={`relative min-h-dvh w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(219,234,254,.55),_transparent_34%),#f8fafc] ${className}`}>
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 shadow-[0_4px_18px_rgba(15,23,42,.04)] backdrop-blur-xl sm:px-8 lg:px-12">
        <button onClick={() => nav('/crew/notifications')} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-[#162d54] shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"><Bell size={19}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-emerald-500"/></button>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-[#162d54] shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"><Menu size={23}/></button>
      </header>
      {children}
      {open && <>
        <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"/>
        <aside className="fixed right-0 top-0 z-50 min-h-dvh w-[290px] overflow-hidden bg-white shadow-2xl sm:w-[360px]">
          <div className="bg-gradient-to-br from-[#162d54] to-[#24558b] px-6 pb-7 pt-5 text-white">
            <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Waves size={23}/></span><button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 transition hover:bg-white/20"><X size={21}/></button></div>
            <p className="mt-5 text-sm font-semibold">Boat Crew Portal</p>
            <p className="mt-1 text-[10px] text-blue-100">Your trips, profile and preferences</p>
          </div>
          <nav className="space-y-2 p-5">{items.map(item => <button key={item.to} onClick={() => { setOpen(false); nav(item.to); }} className={`group flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition ${location.pathname === item.to ? 'bg-blue-50 text-[#162d54]' : 'text-slate-600 hover:bg-slate-50 hover:text-[#162d54]'}`}><span className={`grid h-10 w-10 place-items-center rounded-xl ${location.pathname === item.to ? 'bg-[#162d54] text-white shadow-md' : 'bg-slate-100 text-slate-500 group-hover:bg-white'}`}><item.icon size={19}/></span><span className="text-sm font-semibold">{item.label}</span></button>)}</nav>
        </aside>
      </>}
    </div>
  </main>;
}

export const State = ({ children, tone = 'normal' }: { children: ReactNode; tone?: 'normal' | 'error' }) => <div className={`rounded-2xl border p-8 text-center text-xs shadow-sm ${tone === 'error' ? 'border-red-100 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-500'}`}>{children}</div>;
export const Status = ({ value }: { value: string }) => <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-wide ${['Approved', 'Completed'].includes(value) ? 'bg-emerald-50 text-emerald-600' : value === 'Ongoing' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}><i className="h-1.5 w-1.5 rounded-full bg-current"/>{value}</span>;
