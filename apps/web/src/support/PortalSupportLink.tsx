import { LifeBuoy } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { supportPortals, supportUrl } from './supportNavigation';

export default function PortalSupportLink() {
  const { session } = useAuth();
  const location = useLocation();
  const portal = supportPortals.find(p => location.pathname === p.home || location.pathname.startsWith(p.home + '/'));
  if (!portal || (!session?.roles.includes(portal.role) && portal.role !== 'Passenger')) return null;
  const path = location.pathname.replace(/\/$/, '');
  if (['/owner/settings', '/crew/settings'].includes(path)) return null;
  return <footer className="bg-[#f8f9fb] px-4 py-5 text-center font-[Poppins] text-xs text-slate-500">
    {path !== '/shore/settings' && <Link to={supportUrl(location.pathname + location.search)} className="inline-flex min-h-11 items-center gap-2 rounded px-2 hover:text-cyan-700 focus-visible:outline-2 focus-visible:outline-cyan-600">
      <LifeBuoy size={16} aria-hidden="true" /><span>Need Help? Contact our support center</span>
    </Link>}
    {session && <Link to={`/account?from=${encodeURIComponent(location.pathname + location.search)}`} className="inline-flex min-h-11 items-center rounded px-3 hover:text-cyan-700 focus-visible:outline-2 focus-visible:outline-cyan-600">Account settings</Link>}
  </footer>;
}
