import { apiFetch } from '../api/httpClient';

export class RecoveryApiError extends Error {
  constructor(readonly status: number) {
    super('Password recovery request failed.');
  }
}

export interface RecoveryAccepted {
  recoveryId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface RecoveryVerified {
  resetAuthorization: string;
  expiresInSeconds: number;
}

export async function recoveryPost<T>(endpoint: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await apiFetch(`/api/auth/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal, cache: 'no-store',
  });
  if (!response.ok) throw new RecoveryApiError(response.status);
  return response.json() as Promise<T>;
}
