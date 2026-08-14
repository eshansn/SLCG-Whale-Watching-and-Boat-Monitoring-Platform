import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearSession, login as loginRequest, refreshSession, restoreSession } from './authApi';
import { AuthContext, type AuthStatus } from './authContextValue';
import type { AuthSession, LoginCredentials } from './types';

const REFRESH_LEEWAY_MS = 60_000;
const REFRESH_RETRY_MS = 15_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let active = true;
    restoreSession().then((restoredSession) => {
      if (!active) return;
      setSession(restoredSession);
      setStatus(restoredSession ? 'authenticated' : 'anonymous');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;
    let refreshTimer: number | undefined;

    const scheduleRefresh = (delay: number) => {
      refreshTimer = window.setTimeout(() => {
        void refreshSession()
          .then((refreshedSession) => {
            if (!active) return;
            if (!refreshedSession) {
              logout();
              return;
            }

            setSession(refreshedSession);
            setStatus('authenticated');
          })
          .catch(() => {
            if (active) scheduleRefresh(REFRESH_RETRY_MS);
          });
      }, delay);
    };

    const expiresAt = Date.parse(session.accessTokenExpiresAtUtc);
    const refreshDelay = Number.isNaN(expiresAt)
      ? REFRESH_RETRY_MS
      : Math.max(0, expiresAt - Date.now() - REFRESH_LEEWAY_MS);
    scheduleRefresh(refreshDelay);

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [logout, session]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const nextSession = await loginRequest(credentials);
    setSession(nextSession);
    setStatus('authenticated');
    return nextSession;
  }, []);

  const value = useMemo(
    () => ({ session, status, login, logout }),
    [session, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
