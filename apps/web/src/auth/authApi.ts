import { clearRefreshToken, getRefreshToken, setRefreshToken } from './authStorage';
import type { AuthResponse, AuthSession, LoginCredentials, PortalRole } from './types';
import { apiFetch } from '../api/httpClient';

let restorePromise: Promise<AuthSession | null> | null = null;

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string | string[];
}

export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

interface ApiProblemDetails {
  detail?: string;
  title?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const problem = await response.json() as ApiProblemDetails;
    const validationMessage = problem.errors
      ? Object.values(problem.errors).flat().find(Boolean)
      : undefined;
    return validationMessage
      ?? problem.detail
      ?? problem.message
      ?? (response.status === 401 ? 'Invalid email or password.' : 'Authentication request failed.');
  } catch {
    return response.status === 401 ? 'Invalid email or password.' : 'Authentication request failed.';
  }
}

async function post<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new AuthApiError(await getErrorMessage(response), response.status);
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

export interface PublicRegistration {
  userName: string;
  displayName: string;
  nicNumber: string;
  email: string;
  phoneNumber?: string;
  password: string;
  role: 'BoatOwner' | 'BoatCrew';
}

export async function register(details: PublicRegistration, certificate?: File): Promise<{ message: string }> {
  if (details.role === 'BoatCrew') {
    const body = new FormData();
    Object.entries(details).forEach(([key, value]) => { if (value !== undefined) body.append(key, value); });
    if (certificate) body.append('certificate', certificate);
    const response = await apiFetch('/api/auth/register', { method: 'POST', body });
    if (!response.ok) throw new AuthApiError(await getErrorMessage(response), response.status);
    return response.json() as Promise<{ message: string }>;
  }
  return post<{ message: string }>('/api/auth/register', details);
}

export async function changePassword(accessToken:string,currentPassword:string,newPassword:string):Promise<{message:string}>{
  return post<{message:string}>('/api/auth/change-password',{currentPassword,newPassword},accessToken);
}

export async function refreshSession(): Promise<AuthSession | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await post<AuthResponse>('/api/auth/refresh', { refreshToken });
    setRefreshToken(response.refreshToken);
    return toSession(response);
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      clearRefreshToken();
      return null;
    }

    throw error;
  }
}

async function performRestore(): Promise<AuthSession | null> {
  try {
    return await refreshSession();
  } catch {
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
