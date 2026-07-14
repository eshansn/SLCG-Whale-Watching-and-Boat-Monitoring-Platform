import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { PortalRole } from './types';

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactElement;
  allowedRoles: PortalRole[];
}) {
  const { session, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!allowedRoles.some((role) => session.roles.includes(role))) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
}
