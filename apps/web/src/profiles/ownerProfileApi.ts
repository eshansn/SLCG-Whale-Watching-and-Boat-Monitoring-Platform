import { API_BASE_URL } from '../api/httpClient';

export interface OwnerProfile {
  id: string;
  userName: string;
  displayName: string;
  nicNumber: string | null;
  email: string;
  phoneNumber: string;
  hasProfilePhoto: boolean;
  bio?: string;
}

export interface UpdateOwnerProfile {
  email: string;
  phoneNumber: string;
  bio?: string;
}

async function request<T>(token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/owner/profile`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { title?: string } | null;
    throw new Error(problem?.title ?? `Profile request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const ownerProfileApi = {
  get: (token: string) => request<OwnerProfile>(token),
  update: (token: string, profile: UpdateOwnerProfile) => request<OwnerProfile>(token, {
    method: 'PATCH', body: JSON.stringify(profile),
  }),
  photo: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/api/owner/profile/photo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error('Unable to load profile picture.');
    return URL.createObjectURL(await response.blob());
  },
  uploadPhoto: async (token: string, photo: File) => {
    const form = new FormData(); form.append('photo', photo);
    const response = await fetch(`${API_BASE_URL}/api/owner/profile/photo`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    if (!response.ok) throw new Error('Unable to upload profile picture. Use JPEG, PNG, or WebP under 5 MB.');
    return response.json() as Promise<OwnerProfile>;
  },
};
