import { createContext } from 'react';
import type { AuthSession, LoginCredentials } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  session: AuthSession | null;
  status: AuthStatus;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
