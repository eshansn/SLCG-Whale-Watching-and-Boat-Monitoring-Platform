import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { ComplaintNavLink } from '../Complaints/ComplaintComponents';

export default function SignaturePortalHeader({ portalRole }: { portalRole: 'Supervisor' | 'HarbourOfficer' }) {
  const { session, logout } = useAuth();
  const label = portalRole === 'Supervisor' ? 'Supervisor' : 'Harbour Officer';
  const home = portalRole === 'Supervisor' ? '/supervisor' : '/harbour-officer';
  return <header className="border-b border-slate-200 bg-white shadow-sm">
    <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:gap-4 sm:px-6">
      <Link to={home} aria-label="Portal dashboard" className="flex min-w-0 items-center gap-3">
        <img src="/WildlifeAuthority.png" alt="Department of Wildlife Conservation" className="h-9 w-auto shrink-0 sm:h-10" />
        <div className="hidden min-w-0 border-l pl-3 sm:block"><p className="text-xs text-slate-400">WWMS</p><p className="truncate text-sm font-semibold">{label} Portal</p></div>
      </Link>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {portalRole === 'HarbourOfficer' && <ComplaintNavLink base={home} />}
        <p className="hidden min-w-0 text-right text-xs md:block"><span className="block font-semibold">{label}</span><span className="block max-w-56 truncate text-slate-400">{session?.email}</span></p>
        <button type="button" onClick={() => { logout(); window.location.assign('/login'); }} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#14223d] px-3 text-sm font-semibold text-white sm:px-4"><LogOut size={17} aria-hidden="true" /><span className="hidden min-[360px]:inline">Log out</span></button>
      </div>
    </div>
  </header>;
}
