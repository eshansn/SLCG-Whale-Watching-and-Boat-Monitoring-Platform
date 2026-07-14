import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearSession, login as loginRequest, restoreSession } from './authApi';
import { AuthContext, type AuthStatus } from './authContextValue';
import type { AuthSession, LoginCredentials } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;
    restoreSession().then((restoredSession) => {
      if (!active) return;
      setSession(restoredSession);
      setStatus(restoredSession ? 'authenticated' : 'anonymous');
    });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const nextSession = await loginRequest(credentials);
    setSession(nextSession);
    setStatus('authenticated');
    return nextSession;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ session, status, login, logout }),
    [session, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
