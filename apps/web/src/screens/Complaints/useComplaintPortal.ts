import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

export function useComplaintPortal() {
  const { pathname } = useLocation();
  const { session } = useAuth();
  return { base: `/${pathname.split('/')[1] || 'sltda'}`,
    monitorBase: session?.roles.includes('Admin') ? '/admin' : '/sltda',
    monitor: session?.roles.some(role => role === 'Admin' || role === 'SLTDA') ?? false };
}
