import type { AuthSession, PortalRole } from '../auth/types';

export const supportPortals: { role: PortalRole; label: string; home: string }[] = [
  { role: 'Admin', label: 'Admin Portal', home: '/admin' },
  { role: 'BoatOwner', label: 'Boat Owner Portal', home: '/owner' },
  { role: 'BoatCrew', label: 'Crew Portal', home: '/crew' },
  { role: 'OPS', label: 'Operations Portal', home: '/ops' },
  { role: 'ShoreCrew', label: 'Shore Officer Portal', home: '/shore' },
  { role: 'Supervisor', label: 'Supervisor Portal', home: '/supervisor' },
  { role: 'SLTDA', label: 'SLTDA Portal', home: '/sltda' },
  { role: 'Wildlife', label: 'Wildlife Portal', home: '/wildlife' },
  { role: 'ShoreWildlife', label: 'Shore Wildlife Portal', home: '/shore-wildlife' },
  { role: 'HarbourOfficer', label: 'Harbour Officer Portal', home: '/harbour-officer' },
  { role: 'Passenger', label: 'Passenger Portal', home: '/passenger' },
];

export const supportUrl = (from: string) => `/support?from=${encodeURIComponent(from)}`;

export function supportReturn(from: string | null, session: AuthSession | null) {
  if (from && from.startsWith('/') && !from.startsWith('//')) {
    const url = new URL(from, window.location.origin);
    const portal = supportPortals.find(p => url.pathname === p.home || url.pathname.startsWith(p.home + '/'));
    if (url.origin === window.location.origin && portal && (session?.roles.includes(portal.role) || portal.role === 'Passenger'))
      return { to: url.pathname + url.search, portal };
  }
  const portal = supportPortals.find(p => session?.roles.includes(p.role));
  return { to: portal?.home ?? '/', portal };
}
