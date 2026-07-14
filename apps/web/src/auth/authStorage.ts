const REFRESH_TOKEN_KEY = 'whale-watching-refresh-token';

export function getRefreshToken(): string | null {
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}
