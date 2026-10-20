import { API_BASE_URL as BASE } from '../../api/httpClient';
export const STAFF_ROLES = ['Admin', 'SLTDA', 'OPS', 'ShoreCrew', 'Wildlife', 'ShoreWildlife', 'Supervisor', 'HarbourOfficer'] as const;
export const WILDLIFE_STAFF_ROLES = ['Supervisor', 'HarbourOfficer'] as const;
export type StaffRole = typeof STAFF_ROLES[number];
export interface StaffMember { id: string; displayName: string; userName: string; role: StaffRole; phoneNumber?: string; email: string; isActive: boolean }
export interface StaffUpdate { displayName: string; userName?: string; role: StaffRole; phoneNumber?: string; email: string; isActive: boolean }
async function req<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}/api/admin/staff${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { message?: string; detail?: string; title?: string; errors?: Record<string, string[]> } | null;
    const validation = problem?.errors ? Object.values(problem.errors).flat()[0] : undefined;
    throw new Error(problem?.message ?? validation ?? problem?.detail ?? problem?.title ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const staffApi = {
  list: (token: string) => req<StaffMember[]>(token, ''),
  get: (token: string, id: string) => req<StaffMember>(token, `/${id}`),
  create: (token: string, value: StaffUpdate & { password: string }) => req<StaffMember>(token, '', { method: 'POST', body: JSON.stringify(value) }),
  update: (token: string, id: string, value: StaffUpdate) => req<StaffMember>(token, `/${id}`, { method: 'PATCH', body: JSON.stringify(value) }),
  resetPassword: (token: string, id: string, temporaryPassword: string) => req<{ message: string }>(token, `/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ temporaryPassword }) }),
  remove: (token: string, id: string) => req<void>(token, `/${id}`, { method: 'DELETE' }),
};
