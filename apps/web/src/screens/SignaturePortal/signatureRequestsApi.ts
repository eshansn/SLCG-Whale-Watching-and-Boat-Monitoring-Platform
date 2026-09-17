import { HubConnectionBuilder } from '@microsoft/signalr';

import { API_BASE_URL as BASE } from '../../api/httpClient';
export interface SignatureRequestDetails {
  id: string;
  wildlifeMonitoringRecordId: string;
  attendanceReference: string;
  tripId: string;
  boatName: string;
  registrationNumber: string;
  tripDateUtc: string;
  monitoringOfficer: string;
  requestedByName: string;
  requestedAtUtc: string;
  signatureType: 'Supervisor' | 'HarbourOfficer';
  status: 'Pending' | 'Signed' | 'Declined' | 'Cancelled' | 'Superseded';
  signedAtUtc?: string;
  declinedAtUtc?: string;
  declineReason?: string;
  signatureData?: string;
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}/api/signature-requests${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { message?: string; detail?: string; title?: string; errors?: Record<string, string[]> } | null;
    const validation = problem?.errors ? Object.values(problem.errors).flat()[0] : undefined;
    throw new Error(problem?.message ?? validation ?? problem?.detail ?? problem?.title ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const signatureRequestsApi = {
  list: (token: string) => request<SignatureRequestDetails[]>(token, ''),
  get: (token: string, id: string) => request<SignatureRequestDetails>(token, `/${id}`),
  sign: (token: string, id: string, signatureData: string) => request<SignatureRequestDetails>(token, `/${id}/sign`, { method: 'POST', body: JSON.stringify({ signatureData }) }),
  decline: (token: string, id: string, reason?: string) => request<SignatureRequestDetails>(token, `/${id}/decline`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

export function watchSignatureRequests(token: string, onChange: () => void) {
  const connection = new HubConnectionBuilder().withUrl(`${BASE}/hubs/operations`, {
    accessTokenFactory: () => token,
  }).withAutomaticReconnect().build();
  let disposed = false;
  let timer: number | undefined;
  const start = async () => {
    try { await connection.start(); }
    catch {
      if (!disposed) timer = window.setTimeout(() => void start(), 5000);
    }
  };
  connection.on('signatureRequestChanged', () => { if (!disposed) onChange(); });
  connection.onreconnected(() => { if (!disposed) onChange(); });
  void start();
  return () => { disposed = true; if (timer !== undefined) window.clearTimeout(timer); void connection.stop(); };
}
