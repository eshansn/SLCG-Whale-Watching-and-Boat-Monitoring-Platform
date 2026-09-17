function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!configured) return '';
  try {
    const api = new URL(configured, window.location.origin);
    const browserIsRemote = !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    const apiIsLocal = ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
    if (browserIsRemote && apiIsLocal) {
      console.warn('Ignoring a localhost VITE_API_BASE_URL for a remote browser; using the same public origin.');
      return '';
    }
    return api.origin + api.pathname.replace(/\/$/, '');
  } catch {
    console.warn('VITE_API_BASE_URL is invalid; using the same origin.');
    return '';
  }
}

export const API_BASE_URL = resolveApiBaseUrl();
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), { credentials: 'include', ...init });
}
