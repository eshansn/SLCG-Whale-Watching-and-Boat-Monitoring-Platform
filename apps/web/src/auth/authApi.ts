import { clearRefreshToken, getRefreshToken, setRefreshToken } from './authStorage';
import type { AuthResponse, AuthSession, LoginCredentials, PortalRole } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
let restorePromise: Promise<AuthSession | null> | null = null;

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string | string[];
}

export class AuthApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new AuthApiError(
      response.status === 401 ? 'Invalid email or password.' : 'Authentication request failed.',
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

function decodeJwtPayload(token: string): JwtPayload {
  const payload = token.split('.')[1];
  if (!payload) throw new AuthApiError('The server returned an invalid access token.', 500);

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = decodeURIComponent(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
      .split('')
      .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
  return JSON.parse(decoded) as JwtPayload;
}

function toSession(response: AuthResponse): AuthSession {
  const payload = decodeJwtPayload(response.accessToken);
  const tokenRoles = Array.isArray(payload.role)
    ? payload.role
    : payload.role ? [payload.role] : [];
  const roles = tokenRoles.filter((role): role is PortalRole =>
    response.roles.includes(role as PortalRole));

  if (!payload.sub || !payload.email || roles.length === 0) {
    throw new AuthApiError('The access token is missing required identity claims.', 500);
  }

  return { ...response, roles, userId: payload.sub, email: payload.email };
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  const response = await post<AuthResponse>('/api/auth/login', credentials);
  setRefreshToken(response.refreshToken);
  return toSession(response);
}

async function performRestore(): Promise<AuthSession | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await post<AuthResponse>('/api/auth/refresh', { refreshToken });
    setRefreshToken(response.refreshToken);
    return toSession(response);
  } catch {
    clearRefreshToken();
    return null;
  }
}

export function restoreSession(): Promise<AuthSession | null> {
  restorePromise ??= performRestore().finally(() => {
    window.setTimeout(() => { restorePromise = null; }, 0);
  });
  return restorePromise;
}

export function clearSession(): void {
  clearRefreshToken();
}
